from __future__ import annotations

import asyncio
import json
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.schemas.transaction import StreamControlRequest, StreamStatusOut
from app.services.simulator import event_bus, simulator

router = APIRouter()


@router.get("/stream/status", response_model=StreamStatusOut)
def get_stream_status() -> StreamStatusOut:
    """Return live stream simulator status and telemetry."""
    return StreamStatusOut(**simulator.get_telemetry())


@router.post("/stream/start", response_model=StreamStatusOut)
async def start_stream(payload: StreamControlRequest | None = None) -> StreamStatusOut:
    """Start continuous transaction stream simulator."""
    rate = payload.rate_per_second if payload else 2.0
    res = await simulator.start(rate_per_second=rate)
    return StreamStatusOut(**res)


@router.post("/stream/pause", response_model=StreamStatusOut)
async def pause_stream() -> StreamStatusOut:
    """Pause continuous transaction stream simulator."""
    res = await simulator.pause()
    return StreamStatusOut(**res)


@router.post("/stream/resume", response_model=StreamStatusOut)
async def resume_stream() -> StreamStatusOut:
    """Resume transaction stream simulator."""
    res = await simulator.resume()
    return StreamStatusOut(**res)


@router.post("/stream/stop", response_model=StreamStatusOut)
async def stop_stream() -> StreamStatusOut:
    """Stop transaction stream simulator."""
    res = await simulator.stop()
    return StreamStatusOut(**res)


@router.post("/stream/reset", response_model=StreamStatusOut)
async def reset_stream() -> StreamStatusOut:
    """Reset stream counters and stop generator."""
    res = await simulator.reset()
    return StreamStatusOut(**res)


@router.get("/stream/events")
async def stream_events():
    """
    Server-Sent Events (SSE) feed broadcasting live transactions,
    anomaly scores, and telemetry updates in real time.
    """
    async def event_generator():
        # Yield initial heartbeat
        yield f"event: connected\ndata: {json.dumps(simulator.get_telemetry())}\n\n"
        try:
            async for event in event_bus.subscribe("transactions"):
                yield f"event: transaction\ndata: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

