from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

PHONE_RE = re.compile(
    r"(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{3,5}(?:[\s-]?\d{2,4})?"
)
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
URL_RE = re.compile(r"https?://[^\s<>\"']+|www\.[^\s<>\"']+", re.IGNORECASE)
DOMAIN_RE = re.compile(r"\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|in|io|co|info|biz)\b", re.IGNORECASE)
UPI_RE = re.compile(r"\b[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}\b")
ACCOUNT_RE = re.compile(r"\b(?:a/?c|account(?:\s*(?:no|number|#))?|iban)[:\s#-]*([A-Z0-9]{8,34})\b", re.IGNORECASE)

PHRASE_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("guaranteed_return", re.compile(r"guaranteed\s+(?:returns?|profit|income)|assured\s+(?:returns?|profit)|100%\s+(?:returns?|profit)|risk[- ]?free\s+(?:returns?|profit)", re.I)),
    ("urgency", re.compile(r"\b(?:act now|limited time|today only|hurry|last chance|expires? (?:today|tonight)|immediate(?:ly)? join)\b", re.I)),
    ("advance_payment", re.compile(r"\b(?:advance(?:\s+payment|\s+fee)?|processing fee|registration fee|pay first|deposit now|upfront fee)\b", re.I)),
    ("credential_request", re.compile(r"\b(?:otp|cvv|pin|internet banking|netbanking password|debit card (?:details|number)|share (?:your )?(?:otp|pin|password))\b", re.I)),
    ("financial_solicitation", re.compile(r"\b(?:double your money|secret (?:scheme|tip)|insider (?:tip|deal)|quick riches|get rich|multiply your (?:money|investment))\b", re.I)),
]


@dataclass
class ExtractedItem:
    entity_type: str
    raw_value: str
    normalized_value: str
    source_text: str
    extraction_method: str = "regex"
    confidence: float = 1.0


def _digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def normalize_phone(value: str) -> str | None:
    digits = _digits(value)
    if len(digits) < 10 or len(digits) > 15:
        return None
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) == 10:
        return f"+91{digits}"
    return f"+{digits}"


def normalize_url(value: str) -> str | None:
    candidate = value.strip().rstrip(").,;")
    if candidate.lower().startswith("www."):
        candidate = "http://" + candidate
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    host = parsed.netloc.lower()
    path = parsed.path.rstrip("/")
    return f"{parsed.scheme}://{host}{path}"


def normalize_domain(value: str) -> str:
    return value.lower().strip().lstrip("www.")


def normalize_upi(value: str) -> str | None:
    if EMAIL_RE.fullmatch(value):
        return None
    handle, _, psp = value.partition("@")
    if not handle or not psp:
        return None
    if "." in psp:
        return None
    return f"{handle.lower()}@{psp.lower()}"


def _context(text: str, start: int, end: int, window: int = 40) -> str:
    left = max(0, start - window)
    right = min(len(text), end + window)
    return text[left:right].strip()


def extract_entities(text: str) -> list[ExtractedItem]:
    if not text:
        return []
    found: dict[tuple[str, str], ExtractedItem] = {}

    def add(item: ExtractedItem) -> None:
        key = (item.entity_type, item.normalized_value)
        if key not in found:
            found[key] = item

    for match in PHONE_RE.finditer(text):
        raw = match.group(0).strip()
        normalized = normalize_phone(raw)
        if not normalized:
            continue
        add(ExtractedItem("phone", raw, normalized, _context(text, match.start(), match.end()), "regex"))

    for match in EMAIL_RE.finditer(text):
        raw = match.group(0)
        add(ExtractedItem("email", raw, raw.lower(), _context(text, match.start(), match.end()), "regex"))

    for match in URL_RE.finditer(text):
        raw = match.group(0)
        normalized = normalize_url(raw)
        if not normalized:
            continue
        add(ExtractedItem("url", raw, normalized, _context(text, match.start(), match.end()), "regex"))
        parsed = urlparse(normalized)
        add(ExtractedItem("domain", parsed.netloc, normalize_domain(parsed.netloc), parsed.netloc, "derived"))

    for match in DOMAIN_RE.finditer(text):
        raw = match.group(0)
        if "@" in (text[max(0, match.start() - 1) : match.start()]):
            continue
        add(ExtractedItem("domain", raw, normalize_domain(raw), _context(text, match.start(), match.end()), "regex"))

    for match in UPI_RE.finditer(text):
        raw = match.group(0)
        normalized = normalize_upi(raw)
        if not normalized:
            continue
        add(ExtractedItem("upi", raw, normalized, _context(text, match.start(), match.end()), "regex"))

    for match in ACCOUNT_RE.finditer(text):
        raw = match.group(1)
        add(
            ExtractedItem(
                "account_like",
                raw,
                re.sub(r"\s+", "", raw).upper(),
                _context(text, match.start(), match.end()),
                "regex",
                0.6,
            )
        )

    for phrase_type, pattern in PHRASE_PATTERNS:
        for match in pattern.finditer(text):
            raw = match.group(0)
            add(
                ExtractedItem(
                    "phrase",
                    raw,
                    f"{phrase_type}:{raw.lower()}",
                    _context(text, match.start(), match.end()),
                    "rule",
                    0.9,
                )
            )

    return list(found.values())
