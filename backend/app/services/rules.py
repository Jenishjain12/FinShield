from __future__ import annotations

import re
from typing import Any

# Known suspicious / phishing keywords in UPI handles or notes
PHISHING_PATTERNS = [
    r"sbi[\.\-_]?kyc",
    r"hdfc[\.\-_]?(support|kyc|desk)",
    r"icici[\.\-_]?(verify|desk)",
    r"axis[\.\-_]?(refund|kyc)",
    r"paytm[\.\-_]?(cashback|reward|lottery)",
    r"phonepe[\.\-_]?(refund|prize)",
    r"billdesk[\.\-_]?refund",
    r"electricity[\.\-_]?(bill|board)",
    r"fastag[\.\-_]?(recharge|toll)",
    r"customs[\.\-_]?clearance",
    r"income[\.\-_]?tax[\.\-_]?refund",
    r"rbi[\.\-_]?approved",
]

SUSPICIOUS_NOTE_KEYWORDS = [
    "lottery", "cashback", "refund", "kyc verification", "double money",
    "part time job", "task bonus", "crypto deposit", "instant loan approval",
    "customs duty", "electricity disconnection", "sim block"
]


def evaluate_rules(
    features: dict[str, Any],
    sender_upi_handle: str,
    receiver_upi_handle: str,
    reference_note: str | None = None,
) -> list[dict[str, Any]]:
    """
    Evaluate deterministic UPI anomaly and fraud rules.
    Returns a list of structured rule hits with title, explanation,
    evidence, and score contribution points.
    """
    rule_hits: list[dict[str, Any]] = []
    note_lower = (reference_note or "").lower()
    receiver_lower = receiver_upi_handle.lower()

    # Rule 1: Fake Collect Request
    if features.get("is_collect_request") == 1:
        has_deceptive_note = any(kw in note_lower for kw in SUSPICIOUS_NOTE_KEYWORDS)
        if has_deceptive_note or features.get("amount", 0) >= 5000:
            rule_hits.append({
                "rule_id": "FAKE_COLLECT_REQUEST",
                "title": "Suspected Deceptive Collect Request",
                "severity": "CRITICAL" if has_deceptive_note else "HIGH",
                "explanation": (
                    "Inbound collect/pull request received with deceptive payment note or high value. "
                    "Scammers frequently solicit collect approvals disguised as rewards, refunds, or verifications."
                ),
                "evidence": f"Collect request note: '{reference_note or 'N/A'}', Amount: ₹{features.get('amount')}",
                "contribution": 35,
            })

    # Rule 2: Phishing Payment Handle
    for pat in PHISHING_PATTERNS:
        if re.search(pat, receiver_lower):
            rule_hits.append({
                "rule_id": "PHISHING_PAYMENT_HANDLE",
                "title": "Impersonation / Phishing UPI Handle",
                "severity": "CRITICAL",
                "explanation": (
                    "The beneficiary UPI handle imitates a recognized bank, utility, or financial entity. "
                    "Legitimate organizations rarely receive consumer payments on peer-pattern VPA addresses."
                ),
                "evidence": f"Target VPA '{receiver_upi_handle}' matches phishing signature pattern '{pat}'",
                "contribution": 40,
            })
            break

    # Rule 3: Mule Account Fan-Out Behavior
    if features.get("rapid_in_out_flag") == 1:
        rule_hits.append({
            "rule_id": "MULE_ACCOUNT_FAN_OUT",
            "title": "Rapid Inbound-to-Outbound Fund Drain",
            "severity": "HIGH",
            "explanation": (
                "Account received recent inbound funds and is immediately transferring out the majority of the balance. "
                "This transit behavior is characteristic of intermediate mule accounts used in fraud money laundering."
            ),
            "evidence": f"Outbound ₹{features.get('amount')} matches rapid drain threshold (>70% of recent inbound)",
            "contribution": 30,
        })

    # Rule 4: Rapid Repeated Transfers (Velocity Spike)
    sender_vel_1h = features.get("sender_velocity_1h", 0)
    if sender_vel_1h >= 4:
        rule_hits.append({
            "rule_id": "RAPID_REPEATED_TRANSFERS",
            "title": "Unusual Transaction Frequency Burst",
            "severity": "HIGH" if sender_vel_1h >= 6 else "MEDIUM",
            "explanation": (
                f"Account initiated {sender_vel_1h} transactions within the past hour, "
                "significantly exceeding typical peer-to-peer usage frequency."
            ),
            "evidence": f"Observed 1h velocity: {sender_vel_1h} transactions",
            "contribution": 22 if sender_vel_1h >= 6 else 15,
        })

    # Rule 5: New Payee + High-Value Outlier
    if (
        features.get("is_new_beneficiary") == 1
        and (features.get("amount", 0) >= 25000 or features.get("amount_deviation_from_baseline", 1.0) >= 3.5)
    ):
        rule_hits.append({
            "rule_id": "NEW_PAYEE_HIGH_VALUE",
            "title": "High-Value Transfer to Unverified Beneficiary",
            "severity": "HIGH",
            "explanation": (
                "High-value transfer directed to a first-time beneficiary with no prior transaction history, "
                "deviating substantially from sender baseline average."
            ),
            "evidence": (
                f"Amount: ₹{features.get('amount')} "
                f"({features.get('amount_deviation_from_baseline')}x baseline), New beneficiary: Yes"
            ),
            "contribution": 25,
        })

    # Rule 6: Device Sharing / Mule Ring
    device_reuse = features.get("device_reuse_count", 1)
    if device_reuse >= 3:
        rule_hits.append({
            "rule_id": "DEVICE_SHARING_RING",
            "title": "Device Multi-Account Clustering",
            "severity": "HIGH",
            "explanation": (
                f"The synthetic device fingerprint is associated with {device_reuse} distinct user accounts. "
                "Multi-account hardware sharing is a strong operational indicator of organized fraud rings."
            ),
            "evidence": f"{device_reuse} distinct customer accounts observed on single device ID",
            "contribution": 25,
        })

    # Rule 7: Geographic Inconsistency
    if features.get("geo_discrepancy_flag") == 1 and features.get("is_night") == 1:
        rule_hits.append({
            "rule_id": "GEO_DEVICE_INCONSISTENCY",
            "title": "Off-Hours Regional Location Mismatch",
            "severity": "MEDIUM",
            "explanation": (
                "Transaction originated from an uncharacteristic synthetic geo-region during late night hours. "
                "May indicate account takeover or credential theft."
            ),
            "evidence": "Synthetic IP/Geo differs from primary registered region during off-hours",
            "contribution": 15,
        })

    # Rule 8: Structured Round-Amount Sequence
    if features.get("is_round_number") == 1 and features.get("amount", 0) >= 20000:
        rule_hits.append({
            "rule_id": "ROUND_AMOUNT_PATTERN",
            "title": "Structured Round-Amount Outlier",
            "severity": "MEDIUM",
            "explanation": (
                "Transfer uses an exact high round-figure amount often instructed in social engineering or investment scams."
            ),
            "evidence": f"Exact round figure amount: ₹{features.get('amount')}",
            "contribution": 10,
        })

    return rule_hits

