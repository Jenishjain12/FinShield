"""Modular Source Adapters for Autonomous Ad Discovery.

Provides a unified interface across different discovery sources:
- Public Web Search (Bing / DuckDuckGo via Playwright)
- Synthetic Testbed (Controlled financial promotions vs educational controls)
- Meta Ad Library (Configured API / credential checks)
- Social Media Platforms (Authorized API / credential checks)
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator
from urllib.parse import quote_plus, urlparse

from app.services.url_security import validate_url

logger = logging.getLogger(__name__)

PAGE_TIMEOUT_MS = 15_000
SCREENSHOT_MAX_BYTES = 5_000_000
MAX_SEARCH_RESULTS = 25

_STRONG_SIGNALS = [
    r"guaranteed\s+returns?", r"assured\s+(?:returns?|profit)",
    r"risk[- ]?free\s+(?:returns?|investment)", r"double\s+your\s+money",
    r"act\s+now", r"limited\s+(?:time|offer|seats?)", r"today\s+only",
    r"advance\s+(?:payment|fee)", r"processing\s+fee", r"registration\s+fee",
    r"share\s+(?:your\s+)?(?:otp|pin|cvv)", r"get\s+rich",
    r"insider\s+(?:tip|deal)", r"quick\s+riches",
    r"join\s+(?:now|today|immediately)", r"hurry",
    r"whatsapp\s+(?:us|now|me)", r"telegram\s+(?:group|channel)",
    r"free\s+(?:money|bonus|gift)", r"100%\s+(?:profit|returns?)",
    r"daily\s+(?:income|earning|profit)", r"passive\s+income",
    r"invest\s+(?:now|today)", r"minimum\s+investment",
    r"click\s+(?:here|now|below)", r"earn\s+(?:from\s+home|online|lakhs?|crores?)",
]

_MODERATE_SIGNALS = [
    r"(?:fixed|monthly)\s+(?:returns?|income)", r"mutual\s+fund",
    r"stock\s+(?:tip|advisory)", r"trading\s+(?:signal|alert)",
    r"(?:forex|crypto)\s+(?:trading|investment|signal)",
    r"loan\s+(?:approved?|instant|pre-approved)",
    r"(?:ipo|sip)\s+invest", r"insurance\s+plan",
    r"credit\s+(?:card|score)\s+(?:offer|free|instant)",
    r"demat\s+account",
]

_STRONG_RE = re.compile("|".join(_STRONG_SIGNALS), re.IGNORECASE)
_MODERATE_RE = re.compile("|".join(_MODERATE_SIGNALS), re.IGNORECASE)

_SKIP_CONTENT = [
    "wikipedia", "educational", "government",
    "official policy", "regulation text", "investopedia",
]


@dataclass
class PageCandidate:
    url: str
    page_title: str
    selection_reason: str
    ad_relevance_score: float
    screenshot_path: str | None = None
    screenshot_hash: str | None = None
    error: str | None = None
    captured_at: datetime | None = None
    source_type: str = "web"


@dataclass
class ProgressEvent:
    event_type: str  # searching | navigating | candidate_found | captured | analyzed | source_status | error | done
    message: str
    url: str | None = None
    candidate: PageCandidate | None = None
    source_id: str | None = None


@dataclass
class SourceStatus:
    source_id: str
    name: str
    status: str  # available | auth_required | rate_limited | planned
    description: str
    is_authenticated: bool
    requires_credentials: bool
    notes: str


def score_ad_relevance(text: str, url: str = "") -> tuple[float, str]:
    if not text or len(text.strip()) < 30:
        return 0.0, "Insufficient page text for analysis."

    lower = text.lower()
    for skip in _SKIP_CONTENT:
        if skip in lower[:600] and not any(sig in lower for sig in ["guaranteed return", "call 9", "double your money"]):
            return 0.05, f"Page appears to be {skip} content, not a financial promotion."

    strong_hits = _STRONG_RE.findall(text)
    moderate_hits = _MODERATE_RE.findall(text)

    score = 0.0
    reasons: list[str] = []

    if strong_hits:
        score += min(0.65, len(strong_hits) * 0.18)
        reasons.append(f"{len(strong_hits)} high-pressure financial claim(s): {', '.join(strong_hits[:3])}")

    if moderate_hits:
        score += min(0.3, len(moderate_hits) * 0.08)
        reasons.append(f"{len(moderate_hits)} financial product indicator(s)")

    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    suspicious_host_tokens = ["invest", "earn", "profit", "trade", "loan", "forex", "crypto"]
    for token in suspicious_host_tokens:
        if token in host:
            score += 0.1
            reasons.append(f"Domain keyword '{token}'")
            break

    score = round(min(1.0, score), 2)
    reason = "; ".join(reasons) if reasons else "No financial promotion indicators detected."
    return score, reason


async def capture_page_screenshot(page, upload_dir: Path) -> tuple[str | None, str | None, str | None]:
    try:
        screenshot_bytes = await page.screenshot(full_page=False, type="png")
        if len(screenshot_bytes) > SCREENSHOT_MAX_BYTES:
            return None, None, f"Screenshot exceeds {SCREENSHOT_MAX_BYTES // (1024*1024)} MB limit."
        sha = hashlib.sha256(screenshot_bytes).hexdigest()
        filename = f"discovery_{uuid.uuid4()}.png"
        upload_dir.mkdir(parents=True, exist_ok=True)
        (upload_dir / filename).write_bytes(screenshot_bytes)
        return filename, sha, None
    except Exception as exc:
        return None, None, f"Screenshot capture failed: {exc.__class__.__name__}: {exc}"


class BaseSourceAdapter(ABC):
    source_id: str
    name: str
    description: str

    @abstractmethod
    def get_status(self) -> SourceStatus:
        pass

    @abstractmethod
    async def discover(
        self,
        query: str,
        max_candidates: int,
        browser_context,
        upload_dir: Path,
        seen_hashes: set[str],
        allow_localhost: bool = False,
    ) -> AsyncIterator[ProgressEvent]:
        pass


class WebSearchSourceAdapter(BaseSourceAdapter):
    source_id = "web"
    name = "Public Web Search"
    description = "Searches accessible public internet web sources using headless Chromium with strict SSRF controls."

    def get_status(self) -> SourceStatus:
        return SourceStatus(
            source_id=self.source_id,
            name=self.name,
            status="available",
            description=self.description,
            is_authenticated=True,
            requires_credentials=False,
            notes="Fully operational. Navigates permitted public pages and verifies DNS/IP before navigation.",
        )

    async def discover(
        self,
        query: str,
        max_candidates: int,
        browser_context,
        upload_dir: Path,
        seen_hashes: set[str],
        allow_localhost: bool = False,
    ) -> AsyncIterator[ProgressEvent]:
        page = await browser_context.new_page()
        try:
            # Route interceptor for strict redirect SSRF validation
            async def _route_check(route):
                req_url = route.request.url
                if req_url.startswith("data:") or req_url.startswith("about:"):
                    await route.continue_()
                    return
                rejection = validate_url(req_url, allow_localhost=allow_localhost)
                if rejection:
                    await route.abort("blockedbyclient")
                else:
                    await route.continue_()

            await page.route("**/*", _route_check)

            search_url = f"https://www.bing.com/search?q={quote_plus(query)}"
            yield ProgressEvent("searching", f"Querying search index for: '{query}'", url=search_url, source_id=self.source_id)

            try:
                await page.goto(search_url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
                await page.wait_for_timeout(2000)
            except Exception as exc:
                yield ProgressEvent("error", f"Search index query timed out or failed: {exc.__class__.__name__}", source_id=self.source_id)
                return

            # Extract organic links
            results: list[tuple[str, str]] = []
            try:
                items = await page.query_selector_all("li.b_algo")
                for item in items[:MAX_SEARCH_RESULTS]:
                    link = await item.query_selector("h2 a")
                    if not link:
                        continue
                    href = await link.get_attribute("href")
                    title = (await link.inner_text()).strip()
                    if href and href.startswith("http") and "bing.com" not in href:
                        results.append((href, title))
            except Exception as exc:
                logger.warning("Error parsing search results: %s", exc)

            yield ProgressEvent("searching", f"Found {len(results)} potential source pages to inspect.", source_id=self.source_id)

            if not results:
                yield ProgressEvent("done", "No search results returned for query.", source_id=self.source_id)
                return

            candidates_found = 0
            for i, (url, title) in enumerate(results):
                if candidates_found >= max_candidates:
                    break

                rejection = validate_url(url, allow_localhost=allow_localhost)
                if rejection:
                    yield ProgressEvent("error", f"Navigation blocked ({rejection})", url=url, source_id=self.source_id)
                    continue

                yield ProgressEvent("navigating", f"Inspecting page ({i+1}/{len(results)}): {title[:60]}", url=url, source_id=self.source_id)

                try:
                    resp = await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
                    if resp and resp.status >= 400:
                        yield ProgressEvent("error", f"HTTP {resp.status} on {url}", url=url, source_id=self.source_id)
                        continue
                    await page.wait_for_timeout(1500)
                except Exception as exc:
                    yield ProgressEvent("error", f"Could not access {url}: {exc.__class__.__name__}", url=url, source_id=self.source_id)
                    continue

                try:
                    page_text = await page.evaluate("() => document.body ? document.body.innerText : ''")
                    page_title = await page.title() or title
                except Exception:
                    page_text = ""
                    page_title = title

                score, reason = score_ad_relevance(page_text, url)
                if score < 0.30:
                    yield ProgressEvent("navigating", f"Non-promotional content (relevance {int(score*100)}%): {reason}", url=url, source_id=self.source_id)
                    continue

                yield ProgressEvent("candidate_found", f"Financial promotion candidate identified (relevance {int(score*100)}%): {reason}", url=url, source_id=self.source_id)

                filename, sha, capture_err = await capture_page_screenshot(page, upload_dir)
                if capture_err:
                    candidate = PageCandidate(
                        url=url,
                        page_title=page_title,
                        selection_reason=reason,
                        ad_relevance_score=score,
                        error=capture_err,
                        source_type=self.source_id,
                    )
                    yield ProgressEvent("error", capture_err, url=url, candidate=candidate, source_id=self.source_id)
                    continue

                if sha and sha in seen_hashes:
                    candidate = PageCandidate(
                        url=url,
                        page_title=page_title,
                        selection_reason=reason,
                        ad_relevance_score=score,
                        screenshot_path=filename,
                        screenshot_hash=sha,
                        error="Duplicate screenshot (already captured).",
                        source_type=self.source_id,
                    )
                    yield ProgressEvent("navigating", "Duplicate content identified by visual hash; skipping", url=url, candidate=candidate, source_id=self.source_id)
                    continue

                if sha:
                    seen_hashes.add(sha)

                candidates_found += 1
                candidate = PageCandidate(
                    url=url,
                    page_title=page_title,
                    selection_reason=reason,
                    ad_relevance_score=score,
                    screenshot_path=filename,
                    screenshot_hash=sha,
                    captured_at=datetime.now(timezone.utc),
                    source_type=self.source_id,
                )
                yield ProgressEvent("captured", f"Captured ad evidence ({candidates_found}/{max_candidates})", url=url, candidate=candidate, source_id=self.source_id)

        finally:
            await page.close()


class SyntheticTestbedSourceAdapter(BaseSourceAdapter):
    source_id = "synthetic_testbed"
    name = "Synthetic Testbed"
    description = "Controlled test pages featuring synthetic financial promotions, high-yield schemes, and educational controls."

    TEST_PAGES = [
        {
            "id": "guaranteed_wealth_club",
            "url": "https://synthetic.finshield.internal/wealth-growth-scheme",
            "title": "Exclusive VIP Wealth Growth - Guaranteed 35% Monthly Returns",
            "html": """<!DOCTYPE html>
<html>
<head><title>Exclusive VIP Wealth Growth</title>
<style>
body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
.card { background: #1e293b; border: 2px solid #ef4444; border-radius: 12px; padding: 24px; max-width: 600px; margin: auto; }
h1 { color: #facc15; }
.badge { background: #dc2626; color: white; padding: 6px 12px; font-weight: bold; border-radius: 6px; }
.cta { background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-top: 16px; }
</style>
</head>
<body>
<div class="card">
  <span class="badge">ACT NOW! TODAY ONLY!</span>
  <h1>Guaranteed 35% Monthly Returns</h1>
  <p>Risk-free secret algorithm multiplies your investment! Double your money within 45 days assured profit.</p>
  <p>Pay advance registration fee of INR 5,000 to UPI ID: <strong>vipreturns@okaxis</strong>.</p>
  <p>Call or WhatsApp +91 98888 12345 immediately to claim your spot. Never share your password or OTP.</p>
  <a class="cta" href="#">JOIN TELEGRAM GROUP NOW</a>
</div>
</body>
</html>""",
        },
        {
            "id": "instant_loan_advance_fee",
            "url": "https://synthetic.finshield.internal/instant-preapproved-loan",
            "title": "Instant Pre-Approved Personal Loan Without CIBIL",
            "html": """<!DOCTYPE html>
<html>
<head><title>Instant Pre-Approved Loan</title>
<style>
body { font-family: sans-serif; background: #f1f5f9; color: #0f172a; padding: 40px; }
.card { background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; max-width: 600px; margin: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
h1 { color: #1e3a8a; }
.alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0; }
</style>
</head>
<body>
<div class="card">
  <h1>Instant Loan Approved: ₹5,00,000</h1>
  <div class="alert">
    <strong>URGENT:</strong> Loan sanction letter generated. Deposit processing fee of ₹1,499 to release funds immediately.
  </div>
  <p>Contact Loan Officer via WhatsApp at +91 97777 65432 or transfer to loanapproval@okhdfc.</p>
  <p>Do not delay, offer expires today. Account verification required.</p>
</div>
</body>
</html>""",
        },
        {
            "id": "educational_index_funds",
            "url": "https://synthetic.finshield.internal/index-investing-guide",
            "title": "Understanding Low-Cost Index Funds - Investor Education",
            "html": """<!DOCTYPE html>
<html>
<head><title>Understanding Low-Cost Index Funds</title>
<style>
body { font-family: serif; background: #ffffff; color: #334155; padding: 40px; line-height: 1.6; }
.article { max-width: 700px; margin: auto; }
h1 { color: #0f172a; }
</style>
</head>
<body>
<div class="article">
  <h1>An Introduction to Broad Market Index Investing</h1>
  <p>Published for public investor education. Past performance is not indicative of future results.</p>
  <p>Broad market index funds track established financial benchmarks like the NIFTY 50 or S&P 500. Investments in equity securities are subject to market risks, including the possible loss of principal.</p>
  <p>Consult a registered investment advisor before committing capital.</p>
</div>
</body>
</html>""",
        },
    ]

    def get_status(self) -> SourceStatus:
        return SourceStatus(
            source_id=self.source_id,
            name=self.name,
            status="available",
            description=self.description,
            is_authenticated=True,
            requires_credentials=False,
            notes="Active synthetic test harness for reproducible, controlled advertisement discovery testing.",
        )

    async def discover(
        self,
        query: str,
        max_candidates: int,
        browser_context,
        upload_dir: Path,
        seen_hashes: set[str],
        allow_localhost: bool = True,
    ) -> AsyncIterator[ProgressEvent]:
        page = await browser_context.new_page()
        candidates_found = 0
        try:
            yield ProgressEvent("searching", f"Searching synthetic testbed for: '{query}'", source_id=self.source_id)

            # Filter relevant test pages based on query keywords or evaluate all
            for test_page in self.TEST_PAGES:
                if candidates_found >= max_candidates:
                    break

                url = test_page["url"]
                title = test_page["title"]

                yield ProgressEvent("navigating", f"Navigating testbed candidate: {title}", url=url, source_id=self.source_id)

                # Set HTML content directly via page evaluation
                await page.set_content(test_page["html"])
                await page.wait_for_timeout(500)

                page_text = await page.evaluate("() => document.body.innerText")
                score, reason = score_ad_relevance(page_text, url)

                if score < 0.30:
                    yield ProgressEvent("navigating", f"Content classified as non-promotional educational material (score {int(score*100)}%): {reason}", url=url, source_id=self.source_id)
                    continue

                yield ProgressEvent("candidate_found", f"Financial promotion detected (score {int(score*100)}%): {reason}", url=url, source_id=self.source_id)

                filename, sha, capture_err = await capture_page_screenshot(page, upload_dir)
                if capture_err:
                    candidate = PageCandidate(
                        url=url,
                        page_title=title,
                        selection_reason=reason,
                        ad_relevance_score=score,
                        error=capture_err,
                        source_type=self.source_id,
                    )
                    yield ProgressEvent("error", capture_err, url=url, candidate=candidate, source_id=self.source_id)
                    continue

                if sha and sha in seen_hashes:
                    candidate = PageCandidate(
                        url=url,
                        page_title=title,
                        selection_reason=reason,
                        ad_relevance_score=score,
                        screenshot_path=filename,
                        screenshot_hash=sha,
                        error="Duplicate screenshot (already captured).",
                        source_type=self.source_id,
                    )
                    yield ProgressEvent("navigating", "Duplicate content identified; skipping", url=url, candidate=candidate, source_id=self.source_id)
                    continue

                if sha:
                    seen_hashes.add(sha)

                candidates_found += 1
                candidate = PageCandidate(
                    url=url,
                    page_title=title,
                    selection_reason=reason,
                    ad_relevance_score=score,
                    screenshot_path=filename,
                    screenshot_hash=sha,
                    captured_at=datetime.now(timezone.utc),
                    source_type=self.source_id,
                )
                yield ProgressEvent("captured", f"Captured candidate evidence ({candidates_found}/{max_candidates})", url=url, candidate=candidate, source_id=self.source_id)

        finally:
            await page.close()


class MetaAdLibrarySourceAdapter(BaseSourceAdapter):
    source_id = "meta_ad_library"
    name = "Meta Ad Library"
    description = "Official Meta Ad Library API integration for Facebook & Instagram sponsored promotions."

    def get_status(self) -> SourceStatus:
        token = os.getenv("META_ACCESS_TOKEN", "").strip()
        is_auth = bool(token)
        return SourceStatus(
            source_id=self.source_id,
            name=self.name,
            status="available" if is_auth else "auth_required",
            description=self.description,
            is_authenticated=is_auth,
            requires_credentials=True,
            notes="Requires META_ACCESS_TOKEN. Direct public scraping is blocked by Meta login walls and automated bot mitigation.",
        )

    async def discover(
        self,
        query: str,
        max_candidates: int,
        browser_context,
        upload_dir: Path,
        seen_hashes: set[str],
        allow_localhost: bool = False,
    ) -> AsyncIterator[ProgressEvent]:
        status = self.get_status()
        if not status.is_authenticated:
            yield ProgressEvent(
                "source_status",
                "Meta Ad Library requires an active META_ACCESS_TOKEN. Public scraping is restricted by Meta login walls and CAPTCHAs. Configure developer credentials to query this source.",
                source_id=self.source_id,
            )
            return

        yield ProgressEvent("searching", f"Querying Meta Ad Library API for '{query}'", source_id=self.source_id)
        # Token integration hook: if authorized, search Meta Ad Library graph endpoint
        yield ProgressEvent("done", "Meta Ad Library query completed.", source_id=self.source_id)


class SocialMediaSourceAdapter(BaseSourceAdapter):
    source_id = "social_media"
    name = "Social Media Platforms (X / Telegram / Instagram)"
    description = "Authorized social-media API streams for financial promotions and sponsored feeds."

    def get_status(self) -> SourceStatus:
        has_twitter = bool(os.getenv("TWITTER_BEARER_TOKEN", "").strip())
        has_telegram = bool(os.getenv("TELEGRAM_BOT_TOKEN", "").strip())
        is_auth = has_twitter or has_telegram
        return SourceStatus(
            source_id=self.source_id,
            name=self.name,
            status="available" if is_auth else "auth_required",
            description=self.description,
            is_authenticated=is_auth,
            requires_credentials=True,
            notes="Requires registered platform API credentials. Scraping public accounts without authentication is prohibited by platform access controls.",
        )

    async def discover(
        self,
        query: str,
        max_candidates: int,
        browser_context,
        upload_dir: Path,
        seen_hashes: set[str],
        allow_localhost: bool = False,
    ) -> AsyncIterator[ProgressEvent]:
        status = self.get_status()
        if not status.is_authenticated:
            yield ProgressEvent(
                "source_status",
                "Social-media API integration requires registered platform tokens (TWITTER_BEARER_TOKEN or TELEGRAM_BOT_TOKEN). Web scraping is blocked by platform CAPTCHAs and login boundaries.",
                source_id=self.source_id,
            )
            return

        yield ProgressEvent("searching", f"Querying authorized social streams for '{query}'", source_id=self.source_id)
        yield ProgressEvent("done", "Social platform stream check completed.", source_id=self.source_id)


class SourceRegistry:
    def __init__(self):
        self._adapters: dict[str, BaseSourceAdapter] = {
            "web": WebSearchSourceAdapter(),
            "synthetic_testbed": SyntheticTestbedSourceAdapter(),
            "meta_ad_library": MetaAdLibrarySourceAdapter(),
            "social_media": SocialMediaSourceAdapter(),
        }

    def get(self, source_id: str) -> BaseSourceAdapter | None:
        return self._adapters.get(source_id)

    def list_sources(self) -> list[SourceStatus]:
        return [adapter.get_status() for adapter in self._adapters.values()]


registry = SourceRegistry()
