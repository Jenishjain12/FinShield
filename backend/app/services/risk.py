from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

from app.services.extraction import ExtractedItem

CATEGORY_BANDS = (
    (25, "LOW"),
    (50, "MEDIUM"),
    (75, "HIGH"),
    (101, "CRITICAL"),
)


@dataclass
class SignalResult:
    signal_type: str
    title: str
    explanation: str
    evidence: str
    contribution: int


@dataclass
class RiskAssessment:
    score: int
    category: str
    signals: list[SignalResult]
    limitations: list[str]
    recommendation: str


def categorize(score: int) -> str:
    bounded = max(0, min(100, score))
    for upper, label in CATEGORY_BANDS:
        if bounded < upper:
            return label
    return "CRITICAL"


def _has_phrase(items: list[ExtractedItem], prefix: str) -> list[ExtractedItem]:
    return [item for item in items if item.entity_type == "phrase" and item.normalized_value.startswith(f"{prefix}:")]


def _suspicious_url_reason(url: str) -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?", host):
        return "Host is a raw IP address rather than a registered domain."
    if host.count("-") >= 3:
        return "Domain contains an unusually high number of hyphens."
    if parsed.scheme != "https":
        return "URL uses an unencrypted scheme."
    if any(token in host for token in ("login-", "secure-update", "verify-kyc", "refund-now")):
        return "Domain uses credential-harvesting language in its hostname."
    return None


def assess_risk(
    text: str,
    entities: list[ExtractedItem],
    related_count: int = 0,
    similar_high_risk: bool = False,
    ocr_limitation: str | None = None,
    url_inspected_as_string_only: bool = False,
) -> RiskAssessment:
    signals: list[SignalResult] = []
    used_groups: set[str] = set()

    def add(signal: SignalResult, group: str) -> None:
        if group in used_groups or signal.contribution <= 0:
            return
        used_groups.add(group)
        signals.append(signal)

    guaranteed = _has_phrase(entities, "guaranteed_return")
    if guaranteed:
        add(
            SignalResult(
                "guaranteed_return",
                "Guaranteed-return claim",
                "The copy promises assured or risk-free financial outcomes, a common high-pressure solicitation pattern. This is a triage indicator, not proof of fraud.",
                guaranteed[0].source_text,
                28,
            ),
            "guaranteed_return",
        )

    urgency = _has_phrase(entities, "urgency")
    if urgency:
        add(
            SignalResult(
                "urgency_pressure",
                "Urgency or pressure language",
                "The advertisement uses time pressure to push immediate action, which can reduce an audience's ability to verify claims.",
                urgency[0].source_text,
                16,
            ),
            "urgency",
        )

    advance = _has_phrase(entities, "advance_payment")
    if advance:
        add(
            SignalResult(
                "advance_payment",
                "Advance payment request",
                "The copy asks for fees, deposits, or payments before a stated benefit is delivered.",
                advance[0].source_text,
                22,
            ),
            "advance_payment",
        )

    credentials = _has_phrase(entities, "credential_request")
    if credentials:
        add(
            SignalResult(
                "credential_solicitation",
                "Request for sensitive credentials",
                "The advertisement asks for OTPs, PINs, CVVs, or similar secrets. Legitimate institutions generally do not request these through ads.",
                credentials[0].source_text,
                50,
            ),
            "credential_request",
        )

    solicitation = _has_phrase(entities, "financial_solicitation")
    if solicitation:
        add(
            SignalResult(
                "suspicious_solicitation",
                "High-yield solicitation language",
                "The copy uses get-rich-quick or insider-style financial solicitation phrasing.",
                solicitation[0].source_text,
                16,
            ),
            "financial_solicitation",
        )

    urls = [item for item in entities if item.entity_type == "url"]
    for url in urls:
        reason = _suspicious_url_reason(url.normalized_value)
        if reason:
            add(
                SignalResult(
                    "suspicious_url",
                    "Suspicious URL characteristics",
                    f"{reason} The destination was not fetched; only the submitted URL string was inspected.",
                    url.normalized_value,
                    12,
                ),
                "suspicious_url",
            )
            break

    if related_count >= 2:
        contribution = 8 if related_count < 4 else 14
        add(
            SignalResult(
                "repeated_entities",
                "Shared entities with other advertisements",
                f"This advertisement shares contact, payment, or domain evidence with {related_count} other analyzed advertisements. Shared identifiers suggest a possible relationship, not common criminal ownership.",
                f"{related_count} related advertisements",
                contribution,
            ),
            "repeated_entities",
        )

    if similar_high_risk:
        add(
            SignalResult(
                "similar_high_risk_copy",
                "Similar to a higher-risk advertisement",
                "The text is similar to another advertisement that already carries elevated risk indicators. Similarity is an investigative lead, not independent proof.",
                "TF-IDF cosine similarity above the configured threshold",
                8,
            ),
            "similar_high_risk_copy",
        )

    raw_score = sum(signal.contribution for signal in signals)
    score = max(0, min(100, raw_score))

    limitations = [
        "The score is a configured rules-based triage assessment, not a statistically calibrated probability of fraud.",
        "Extracted identifiers are observable strings, not verified identities.",
    ]
    if ocr_limitation:
        limitations.append(ocr_limitation)
    if url_inspected_as_string_only:
        limitations.append("Submitted URLs were parsed as text only; destinations were not fetched or executed.")
    if not text.strip():
        limitations.append("No advertisement text was available, so analysis coverage is limited.")

    if score >= 75:
        recommendation = "Prioritize investigator review. Collect corroborating evidence before any enforcement action."
    elif score >= 50:
        recommendation = "Review extracted entities and related advertisements. Treat findings as potentially suspicious until verified."
    elif score >= 25:
        recommendation = "Monitor for additional matching evidence. The current indicators are moderate."
    else:
        recommendation = "No elevated rule-based indicators were found. This does not certify legitimacy."

    return RiskAssessment(
        score=score,
        category=categorize(score),
        signals=signals,
        limitations=limitations,
        recommendation=recommendation,
    )
