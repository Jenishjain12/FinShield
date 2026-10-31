from __future__ import annotations

import asyncio
import json
import logging
import random
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, AsyncGenerator

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.account import CustomerAccount
from app.models.stream_run import StreamRun
from app.services.generator import (
    FIRST_NAMES,
    INDIAN_BANKS,
    LAST_NAMES,
    PHISHING_HANDLES,
    REGIONS,
    SCAM_NOTES,
)
from app.services.scoring import score_and_assess_transaction
from app.services.ml import explain_ml_anomaly

logger = logging.getLogger("finshield.simulator")


class EventStreamInterface(ABC):
    """Abstract interface decoupling application logic from transport (In-Memory vs Kafka)."""

    @abstractmethod
    async def publish(self, topic: str, event: dict[str, Any]) -> None:
        pass

    @abstractmethod
    async def subscribe(self, topic: str) -> AsyncGenerator[dict[str, Any], None]:
        pass


class InMemoryEventBus(EventStreamInterface):
    """Local high-performance asyncio queue implementation of EventStreamInterface."""

    def __init__(self) -> None:
        self._queues: list[asyncio.Queue[dict[str, Any]]] = []

    async def publish(self, topic: str, event: dict[str, Any]) -> None:
        dead_queues = []
        for q in self._queues:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass
            except Exception:
                dead_queues.append(q)
        for dq in dead_queues:
            if dq in self._queues:
                self._queues.remove(dq)

    async def subscribe(self, topic: str) -> AsyncGenerator[dict[str, Any], None]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        self._queues.append(q)
        try:
            while True:
                item = await q.get()
                yield item
        finally:
            if q in self._queues:
                self._queues.remove(q)


# Singleton event bus
event_bus = InMemoryEventBus()


class TransactionStreamSimulator:
    """
    Kafka-like Transaction Stream Simulator.
    Generates synthetic payments, runs them through the ML + Rule pipeline,
    and publishes events to the event bus.
    """

    def __init__(self, bus: EventStreamInterface = event_bus) -> None:
        self.bus = bus
        self._status: str = "stopped"  # "stopped", "running", "paused"
        self._rate_per_sec: float = 2.0
        self._task: asyncio.Task[None] | None = None
        self._emitted_count: int = 0
        self._anomaly_count: int = 0
        self._started_at: datetime | None = None
        self._stop_event = asyncio.Event()

    @property
    def status(self) -> str:
        return self._status

    def get_telemetry(self) -> dict[str, Any]:
        return {
            "status": self._status,
            "engine": "In-Memory Event Bus (Kafka-compatible interface)",
            "kafka_connected": False,  # Transparent truth: not claiming Kafka unless configured
            "rate_per_second": self._rate_per_sec,
            "transactions_emitted": self._emitted_count,
            "anomalies_detected": self._anomaly_count,
            "anomaly_rate_pct": (
                round((self._anomaly_count / max(self._emitted_count, 1)) * 100, 1)
            ),
            "started_at": self._started_at.isoformat() if self._started_at else None,
        }

    async def start(self, rate_per_second: float = 2.0) -> dict[str, Any]:
        if self._status == "running":
            return self.get_telemetry()

        self._rate_per_sec = max(0.5, min(10.0, rate_per_second))
        self._status = "running"
        self._stop_event.clear()
        if not self._started_at:
            self._started_at = datetime.utcnow()

        self._task = asyncio.create_task(self._run_loop())
        await self.bus.publish("stream_control", {"event": "started", "telemetry": self.get_telemetry()})
        return self.get_telemetry()

    async def pause(self) -> dict[str, Any]:
        if self._status == "running":
            self._status = "paused"
            await self.bus.publish("stream_control", {"event": "paused", "telemetry": self.get_telemetry()})
        return self.get_telemetry()

    async def resume(self) -> dict[str, Any]:
        if self._status == "paused":
            self._status = "running"
            await self.bus.publish("stream_control", {"event": "resumed", "telemetry": self.get_telemetry()})
        return self.get_telemetry()

    async def stop(self) -> dict[str, Any]:
        self._status = "stopped"
        self._stop_event.set()
        if self._task and not self._task.done():
            self._task.cancel()
        self._started_at = None
        await self.bus.publish("stream_control", {"event": "stopped", "telemetry": self.get_telemetry()})
        return self.get_telemetry()

    async def reset(self) -> dict[str, Any]:
        await self.stop()
        self._emitted_count = 0
        self._anomaly_count = 0
        await self.bus.publish("stream_control", {"event": "reset", "telemetry": self.get_telemetry()})
        return self.get_telemetry()

    async def _run_loop(self) -> None:
        """Internal generator loop."""
        try:
            while not self._stop_event.is_set():
                if self._status == "paused":
                    await asyncio.sleep(0.5)
                    continue

                if self._status != "running":
                    break

                # Sleep interval based on rate
                interval = 1.0 / max(self._rate_per_sec, 0.5)
                await asyncio.sleep(interval)

                # Generate and process single synthetic transaction
                try:
                    await self._emit_single_transaction()
                except Exception as exc:
                    logger.warning("Simulator transaction emission error: %s", exc)

        except asyncio.CancelledError:
            pass

    async def _emit_single_transaction(self) -> None:
        db: Session = SessionLocal()
        try:
            accounts = db.query(CustomerAccount).limit(40).all()
            if not accounts:
                return

            sender = random.choice(accounts)
            receiver = random.choice(accounts)
            while receiver.account_id == sender.account_id:
                receiver = random.choice(accounts)

            now = datetime.utcnow()
            # 18% anomaly probability during live simulation
            is_anomaly = (random.random() < 0.18)

            if not is_anomaly:
                amount = round(random.uniform(100.0, sender.baseline_avg_amount * 1.3), 2)
                tx_type = "pay"
                channel = "upi_app"
                note = random.choice(["Split bill", "Coffee", "Groceries", "Uber", None])
                dev_id = sender.primary_device_id
                geo = sender.primary_geo_region
                ip = f"103.21.{random.randint(10, 240)}.{random.randint(1, 250)}"
                receiver_vpa = receiver.primary_upi_handle
            else:
                sim_pattern = random.choice([
                    "fake_collect", "phishing_vpa", "high_deviation", "mule_spike"
                ])
                if sim_pattern == "fake_collect":
                    amount = float(random.choice([4999, 9999, 14999, 25000]))
                    tx_type = "collect"
                    channel = "collect_request"
                    note = random.choice(SCAM_NOTES)
                    dev_id = f"DEV_COLLECT_{random.randint(100, 999)}"
                    geo = random.choice(REGIONS)
                    ip = f"185.220.{random.randint(10, 240)}.{random.randint(1, 250)}"
                    receiver_vpa = random.choice(PHISHING_HANDLES)
                elif sim_pattern == "phishing_vpa":
                    amount = round(random.uniform(5000.0, 35000.0), 2)
                    tx_type = "pay"
                    channel = "web_portal"
                    note = "KYC update verification"
                    dev_id = sender.primary_device_id
                    geo = sender.primary_geo_region
                    ip = f"103.21.{random.randint(10, 240)}.{random.randint(1, 250)}"
                    receiver_vpa = random.choice(PHISHING_HANDLES)
                else:
                    amount = round(sender.baseline_avg_amount * random.uniform(4.5, 8.0), 2)
                    tx_type = "pay"
                    channel = "upi_app"
                    note = "emergency transfer"
                    dev_id = sender.primary_device_id
                    geo = random.choice(REGIONS)
                    ip = f"103.21.{random.randint(10, 240)}.{random.randint(1, 250)}"
                    receiver_vpa = receiver.primary_upi_handle

            txn, assessment, alerts = score_and_assess_transaction(
                db=db,
                amount=amount,
                sender_account_id=sender.account_id,
                receiver_account_id=receiver.account_id,
                sender_upi_handle=sender.primary_upi_handle,
                receiver_upi_handle=receiver_vpa,
                device_id=dev_id,
                synthetic_ip=ip,
                synthetic_geo_region=geo,
                transaction_type=tx_type,
                channel=channel,
                reference_note=note,
                timestamp=now,
                persist=True,
            )

            self._emitted_count += 1
            if txn.risk_category in ("CRITICAL", "HIGH", "MEDIUM"):
                self._anomaly_count += 1

            # Compute ML deviation explanations if anomalous
            ml_exps = []
            if assessment and assessment.feature_snapshot:
                ml_exps = explain_ml_anomaly(assessment.feature_snapshot, top_k=2)

            # Broadcast event over event bus
            event_payload = {
                "event_type": "transaction_processed",
                "transaction_id": txn.transaction_id,
                "amount": txn.amount,
                "currency": txn.currency,
                "transaction_type": txn.transaction_type,
                "sender_upi_handle": txn.sender_upi_handle,
                "receiver_upi_handle": txn.receiver_upi_handle,
                "risk_score": txn.risk_score,
                "risk_category": txn.risk_category,
                "anomaly_score": txn.anomaly_score,
                "timestamp": txn.timestamp.isoformat(),
                "alerts_generated": len(alerts),
                "rule_hits": assessment.rule_hits if assessment else [],
                "ml_explanations": ml_exps,
                "telemetry": self.get_telemetry(),
            }
            await self.bus.publish("transactions", event_payload)

        finally:
            db.close()


# Global simulator instance
simulator = TransactionStreamSimulator()

