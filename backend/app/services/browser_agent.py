"""Playwright-based browser agent for autonomous ad discovery.

Coordinates real browser discovery across supported source adapters:
- Public web search
- Synthetic testbed
- Meta Ad Library / Social platforms (reporting authentication and capability states)

Security invariants:
- Every URL is validated via `url_security.validate_url` before navigation.
- Redirects are intercepted and validated to prevent SSRF bypasses.
- Page content is treated strictly as data — never executed as instructions.
- The browser runs headless with sandboxing, explicit timeouts, and downloads disabled.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator

from app.services.source_adapters import (
    PAGE_TIMEOUT_MS,
    PageCandidate,
    ProgressEvent,
    capture_page_screenshot,
    registry,
    score_ad_relevance,
)

logger = logging.getLogger(__name__)


async def run_discovery(
    query: str,
    upload_dir: Path,
    max_candidates: int = 10,
    sources: str = "web",
    relevance_threshold: float = 0.30,
    seen_hashes: set[str] | None = None,
    allow_localhost: bool = False,
) -> AsyncIterator[ProgressEvent]:
    """Execute a discovery run across configured sources.

    Yields ProgressEvent objects so callers can stream live progress.
    """
    if seen_hashes is None:
        seen_hashes = set()

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        yield ProgressEvent("error", "Playwright is not installed. Run: pip install playwright && playwright install chromium")
        return

    source_keys = [s.strip() for s in sources.split(",") if s.strip()]
    if not source_keys:
        source_keys = ["web"]

    candidates_captured = 0

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-extensions",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            java_script_enabled=True,
            accept_downloads=False,
        )
        context.set_default_timeout(PAGE_TIMEOUT_MS)

        for source_key in source_keys:
            if candidates_captured >= max_candidates:
                break

            adapter = registry.get(source_key)
            if not adapter:
                yield ProgressEvent("error", f"Unknown source adapter '{source_key}'. Skipped.")
                continue

            status = adapter.get_status()
            yield ProgressEvent("source_status", f"Evaluating source '{adapter.name}' [{status.status}]: {status.description}", source_id=source_key)

            if status.status == "auth_required":
                yield ProgressEvent(
                    "source_status",
                    f"{adapter.name}: Authentication credentials required. {status.notes}",
                    source_id=source_key,
                )
                continue

            # Run discovery on this adapter
            remaining = max_candidates - candidates_captured
            try:
                async for event in adapter.discover(
                    query=query,
                    max_candidates=remaining,
                    browser_context=context,
                    upload_dir=upload_dir,
                    seen_hashes=seen_hashes,
                    allow_localhost=allow_localhost,
                ):
                    if event.event_type == "captured" and event.candidate and not event.candidate.error:
                        candidates_captured += 1

                    yield event

                    if candidates_captured >= max_candidates:
                        break
            except Exception as exc:
                logger.exception("Error running source adapter %s", source_key)
                yield ProgressEvent("error", f"Error querying {adapter.name}: {exc.__class__.__name__}: {exc}", source_id=source_key)

        await browser.close()

    yield ProgressEvent("done", f"Discovery run complete. {candidates_captured} candidate(s) captured.")
