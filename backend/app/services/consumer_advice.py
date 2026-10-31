from __future__ import annotations

from typing import Any
from app.services.ml import explain_ml_anomaly

# Rule-specific localized explanations
RULE_EXPLANATIONS: dict[str, dict[str, str]] = {
    "FAKE_COLLECT_REQUEST": {
        "en": "This is a collect request asking you to approve sending money, NOT receiving a refund or cashback.",
        "hi": "यह एक कलेक्ट अनुरोध है जिसमें आपसे पैसे भेजने की अनुमति मांगी जा रही है, न कि रिफंड या कैशबैक प्राप्त करने की।",
    },
    "PHISHING_PAYMENT_HANDLE": {
        "en": "The payee handle uses official-sounding words ('refund', 'sbi', 'support') but routes to an unverified private account.",
        "hi": "प्राप्तकर्ता का यूपीआई हैंडल आधिकारिक शब्दों ('रिफंड', 'एसबीआई', 'सपोर्ट') की नकल कर रहा है परंतु यह एक असत्यापित खाते से जुड़ा है।",
    },
    "MULE_ACCOUNT_FAN_OUT": {
        "en": "This payee account has received incoming transfers from multiple different users in the last hour.",
        "hi": "इस प्राप्तकर्ता खाते में पिछले एक घंटे में कई अलग-अलग उपयोगकर्ताओं से पैसे स्थानांतरित हुए हैं।",
    },
    "RAPID_REPEATED_TRANSFERS": {
        "en": "Unusually high frequency of transfers detected to this recipient within a short time window.",
        "hi": "कम समय के अंतराल में इस प्राप्तकर्ता को असामान्य रूप से तेज़ गति से बार-बार भुगतान का प्रयास देखा गया है।",
    },
    "NEW_PAYEE_HIGH_VALUE": {
        "en": "This is a first-time transfer of a large amount to a beneficiary you have never paid before.",
        "hi": "यह एक नए प्राप्तकर्ता को बड़ी राशि का पहला भुगतान है जिसे आपने पहले कभी पैसे नहीं भेजे हैं।",
    },
    "DEVICE_SHARING_RING": {
        "en": "The device initiating or receiving this transfer has been linked to multiple distinct UPI identities.",
        "hi": "इस भुगतान से जुड़ा उपकरण कई अलग-अलग यूपीआई खातों और पहचानों के साथ उपयोग में देखा गया है।",
    },
    "GEO_DEVICE_INCONSISTENCY": {
        "en": "Transaction location and network differ significantly from your customary usage area.",
        "hi": "लेनदेन का स्थान और नेटवर्क आपके सामान्य उपयोग वाले क्षेत्र से काफी भिन्न है।",
    },
    "ROUND_AMOUNT_PATTERN": {
        "en": "The exact round-number amount matches patterns often used in automated payment testing.",
        "hi": "गोल राशि (राउंड नंबर) का यह प्रारूप अक्सर स्वचालित परीक्षण या संदिग्ध लेनदेन पैटर्न में देखा जाता है।",
    },
}

HEADLINES = {
    "DONT_APPROVE": {
        "en": "Do not authorize this payment request",
        "hi": "इस भुगतान अनुरोध को स्वीकृत न करें",
    },
    "BE_CAREFUL": {
        "en": "Verify recipient details carefully before approving",
        "hi": "स्वीकृत करने से पहले प्राप्तकर्ता के विवरण की सावधानीपूर्वक जाँच करें",
    },
    "LOOKS_NORMAL": {
        "en": "Payment request appears consistent with normal activity",
        "hi": "भुगतान अनुरोध सामान्य गतिविधियों के अनुरूप लग रहा है",
    },
}

WHAT_TO_DO_ADVICE = {
    "DONT_APPROVE": {
        "en": [
            "If someone on a phone call or chat told you to approve this or enter your UPI PIN to receive money, hang up immediately. A UPI PIN is NEVER required to receive money or refunds.",
            "Decline this collect request in your UPI application.",
            "If you suspect fraud, report the UPI ID immediately to the National Cyber Crime Helpline at 1930 or cybercrime.gov.in.",
            "Verify payment requests directly through the merchant's official app or bank customer care number.",
        ],
        "hi": [
            "यदि किसी ने कॉल पर पैसे पाने के लिए यूपीआई पिन डालने को कहा है, तो तुरंत कॉल काट दें। पैसे प्राप्त करने के लिए कभी भी पिन की आवश्यकता नहीं होती।",
            "अपने यूपीआई ऐप में इस कलेक्ट अनुरोध को तुरंत अस्वीकार (Decline) करें।",
            "धोखाधड़ी की आशंका होने पर तुरंत राष्ट्रीय साइबर हेल्पलाइन 1930 पर कॉल करें या cybercrime.gov.in पर रिपोर्ट दर्ज करें।",
            "किसी भी भुगतान की पुष्टि केवल संबंधित मर्चेंट के आधिकारिक ऐप या बैंक की वेबसाइट से करें।",
        ],
    },
    "BE_CAREFUL": {
        "en": [
            "Double-check the beneficiary UPI handle and account holder name before typing your PIN.",
            "Ensure you recognize the service or person requesting this specific amount.",
            "If in doubt, send a test payment of ₹1 first or contact the recipient via a trusted phone number.",
        ],
        "hi": [
            "अपना पिन डालने से पहले प्राप्तकर्ता का यूपीआई हैंडल और पंजीकृत नाम दोबारा जाँच लें।",
            "पुष्टि करें कि आप उस व्यक्ति या मर्चेंट को भली-भांति जानते हैं जिसने यह राशि मांगी है।",
            "संदेह होने पर पहले ₹1 का परीक्षण भुगतान करें या प्राप्तकर्ता से सीधे फोन पर संपर्क करें।",
        ],
    },
    "LOOKS_NORMAL": {
        "en": [
            "Always verify the receiver's name displayed on your bank's UPI confirmation screen before entering your PIN.",
            "Never share your UPI PIN, OTP, or SMS codes with anyone under any circumstances.",
        ],
        "hi": [
            "पिन दर्ज करने से पहले बैंक की यूपीआई स्क्रीन पर प्रदर्शित प्राप्तकर्ता का नाम अवश्य जाँच लें।",
            "अपना यूपीआई पिन, ओटीपी या एसएमएस कोड कभी भी किसी के साथ साझा न करें।",
        ],
    },
}

DISCLAIMERS = {
    "en": "This is an automated risk indicator based on observed payment patterns, not a final determination. Synthetic demo data.",
    "hi": "यह भुगतान पैटर्न पर आधारित एक स्वचालित जोखिम संकेतक है, कोई अंतिम निर्णय नहीं। सिंथेटिक डेमो डेटा।",
}


def build_consumer_advice(
    transaction: Any,
    assessment: Any | None = None,
    lang: str = "en",
) -> dict[str, Any]:
    """
    Generate plain-language deterministic consumer advice for payers.
    Maps risk indicators to clear verdicts, human-understandable reasons, and protective actions.
    """
    lang = "hi" if lang == "hi" else "en"

    # Extract transaction fields
    if isinstance(transaction, dict):
        amount = float(transaction.get("amount", 0.0))
        receiver_handle = str(transaction.get("receiver_upi_handle", "unknown@upi"))
        receiver_account = str(transaction.get("receiver_account_id", ""))
        timestamp_val = str(transaction.get("timestamp", ""))
        triage_score = int(transaction.get("risk_score", 0))
        risk_category = str(transaction.get("risk_category", "LOW")).upper()
    else:
        amount = float(getattr(transaction, "amount", 0.0))
        receiver_handle = str(getattr(transaction, "receiver_upi_handle", "unknown@upi"))
        receiver_account = str(getattr(transaction, "receiver_account_id", ""))
        ts = getattr(transaction, "timestamp", None)
        timestamp_val = ts.isoformat() if hasattr(ts, "isoformat") else str(ts or "")
        triage_score = int(getattr(transaction, "risk_score", 0))
        risk_category = str(getattr(transaction, "risk_category", "LOW")).upper()

    # Extract assessment fields
    rule_hits: list[dict[str, Any]] = []
    feature_snapshot: dict[str, Any] = {}
    if assessment is not None:
        if isinstance(assessment, dict):
            rule_hits = assessment.get("rule_hits", []) or []
            feature_snapshot = assessment.get("feature_snapshot", {}) or {}
            if "triage_score" in assessment:
                triage_score = int(assessment["triage_score"])
            if "risk_category" in assessment:
                risk_category = str(assessment["risk_category"]).upper()
        else:
            rule_hits = getattr(assessment, "rule_hits", []) or []
            feature_snapshot = getattr(assessment, "feature_snapshot", {}) or {}
            if hasattr(assessment, "triage_score") and assessment.triage_score is not None:
                triage_score = int(assessment.triage_score)
            if hasattr(assessment, "risk_category") and assessment.risk_category:
                risk_category = str(assessment.risk_category).upper()

    # Determine verdict
    if risk_category in ("CRITICAL", "HIGH") or triage_score >= 50:
        verdict = "DONT_APPROVE"
    elif risk_category == "MEDIUM" or triage_score >= 25:
        verdict = "BE_CAREFUL"
    else:
        verdict = "LOOKS_NORMAL"

    headline = HEADLINES[verdict][lang]

    # Build human reasons
    reasons: list[str] = []
    # 1. From rule hits
    for rh in rule_hits:
        rule_id = rh.get("rule_id", "")
        if rule_id in RULE_EXPLANATIONS:
            explanation = RULE_EXPLANATIONS[rule_id][lang]
            if explanation not in reasons:
                reasons.append(explanation)
        elif rh.get("explanation"):
            reasons.append(rh["explanation"])

    # 2. From ML deviations if rule hits are sparse
    if len(reasons) < 3 and feature_snapshot:
        ml_explanations = explain_ml_anomaly(feature_snapshot, top_k=2)
        for me in ml_explanations:
            ht = me.get("human_text")
            if ht and ht not in reasons:
                reasons.append(ht)

    # 3. Fallback reason if clean
    if not reasons:
        if verdict == "LOOKS_NORMAL":
            reasons.append(
                "Payment parameters and recipient profile match typical historical consumer activity."
                if lang == "en"
                else "भुगतान पैरामीटर और प्राप्तकर्ता प्रोफ़ाइल सामान्य ऐतिहासिक उपभोक्ता गतिविधि से मेल खाते हैं।"
            )
        else:
            reasons.append(
                "Transaction deviates from standard baseline frequency and amount patterns."
                if lang == "en"
                else "लेनदेन सामान्य आवृत्ति और राशि पैटर्न से भिन्न है।"
            )

    what_to_do = WHAT_TO_DO_ADVICE[verdict][lang]

    evidence = {
        "amount": amount,
        "receiver_handle": receiver_handle,
        "receiver_account": receiver_account,
        "time": timestamp_val,
        "rule_hits_count": len(rule_hits),
        "triage_score": triage_score,
        "risk_category": risk_category,
    }

    return {
        "verdict": verdict,
        "headline": headline,
        "reasons": reasons[:3],
        "what_to_do": what_to_do,
        "evidence": evidence,
        "disclaimer": DISCLAIMERS[lang],
        "lang": lang,
    }

