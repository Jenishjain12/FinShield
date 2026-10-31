from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Advertisement, AdvertisementRelationship, ExtractedEntity
from app.services.similarity import text_similarity

MATCHABLE_TYPES = ("phone", "url", "domain", "upi", "email", "account_like")


@dataclass
class MatchCandidate:
    source_ad_id: str
    target_ad_id: str
    relationship_type: str
    evidence_key: str
    evidence: str
    explanation: str
    similarity_score: float | None = None


def _ordered(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a < b else (b, a)


def find_entity_matches(db: Session, advertisement: Advertisement) -> list[MatchCandidate]:
    matches: list[MatchCandidate] = []
    seen: set[tuple[str, str, str, str]] = set()
    for entity in advertisement.entities:
        if entity.entity_type not in MATCHABLE_TYPES:
            continue
        others = (
            db.query(ExtractedEntity)
            .filter(
                ExtractedEntity.entity_type == entity.entity_type,
                ExtractedEntity.normalized_value == entity.normalized_value,
                ExtractedEntity.advertisement_id != advertisement.id,
            )
            .all()
        )
        for other in others:
            source, target = _ordered(advertisement.id, other.advertisement_id)
            key = (source, target, entity.entity_type, entity.normalized_value)
            if key in seen:
                continue
            seen.add(key)
            matches.append(
                MatchCandidate(
                    source_ad_id=source,
                    target_ad_id=target,
                    relationship_type=f"shared_{entity.entity_type}",
                    evidence_key=entity.normalized_value,
                    evidence=entity.normalized_value,
                    explanation=(
                        f"Both advertisements contain the same normalized {entity.entity_type.replace('_', ' ')}."
                        " Shared identifiers are relationship evidence, not proof of common ownership."
                    ),
                )
            )
    return matches


def find_similarity_matches(db: Session, advertisement: Advertisement) -> list[MatchCandidate]:
    settings = get_settings()
    if not advertisement.text or len(advertisement.text.split()) < 8:
        return []
    others = db.query(Advertisement).filter(Advertisement.id != advertisement.id, Advertisement.analysis_status == "completed").all()
    matches: list[MatchCandidate] = []
    for other in others:
        if not other.text or len(other.text.split()) < 8:
            continue
        score = text_similarity(advertisement.text, other.text)
        if score < settings.similarity_threshold:
            continue
        source, target = _ordered(advertisement.id, other.id)
        matches.append(
            MatchCandidate(
                source_ad_id=source,
                target_ad_id=target,
                relationship_type="text_similarity",
                evidence_key="tfidf",
                evidence=f"cosine={score:.3f}",
                explanation=(
                    f"Advertisement texts are similar (TF-IDF cosine {score:.2f}, threshold {settings.similarity_threshold:.2f})."
                    " Similarity is an inferred lead, not an observed shared identifier."
                ),
                similarity_score=round(score, 4),
            )
        )
    return matches


def persist_matches(db: Session, matches: list[MatchCandidate]) -> list[AdvertisementRelationship]:
    stored: list[AdvertisementRelationship] = []
    for match in matches:
        existing = (
            db.query(AdvertisementRelationship)
            .filter_by(
                source_ad_id=match.source_ad_id,
                target_ad_id=match.target_ad_id,
                relationship_type=match.relationship_type,
                evidence_key=match.evidence_key,
            )
            .one_or_none()
        )
        if existing:
            stored.append(existing)
            continue
        rel = AdvertisementRelationship(
            source_ad_id=match.source_ad_id,
            target_ad_id=match.target_ad_id,
            relationship_type=match.relationship_type,
            evidence_key=match.evidence_key,
            evidence=match.evidence,
            explanation=match.explanation,
            similarity_score=match.similarity_score,
        )
        db.add(rel)
        stored.append(rel)
    return stored
