from __future__ import annotations

from collections import defaultdict

from sqlalchemy.orm import Session

from app.models import Advertisement, AdvertisementRelationship


def _neighbors(db: Session) -> dict[str, set[str]]:
    graph: dict[str, set[str]] = defaultdict(set)
    for rel in db.query(AdvertisementRelationship).all():
        graph[rel.source_ad_id].add(rel.target_ad_id)
        graph[rel.target_ad_id].add(rel.source_ad_id)
    return graph


def connected_clusters(db: Session) -> list[list[str]]:
    graph = _neighbors(db)
    seen: set[str] = set()
    clusters: list[list[str]] = []
    for node in graph:
        if node in seen:
            continue
        stack = [node]
        component: list[str] = []
        seen.add(node)
        while stack:
            current = stack.pop()
            component.append(current)
            for neighbor in graph.get(current, set()):
                if neighbor not in seen:
                    seen.add(neighbor)
                    stack.append(neighbor)
        if len(component) >= 2:
            clusters.append(sorted(component))
    clusters.sort(key=lambda items: (-len(items), items[0]))
    return clusters


def campaign_id_for(members: list[str]) -> str:
    return f"cluster-{min(members)[:8]}"


def list_campaigns(db: Session) -> list[dict]:
    ads = {ad.id: ad for ad in db.query(Advertisement).all()}
    campaigns = []
    for members in connected_clusters(db):
        member_ads = [ads[ad_id] for ad_id in members if ad_id in ads]
        if not member_ads:
            continue
        high_risk = sum(1 for ad in member_ads if ad.risk_score >= 50)
        campaigns.append(
            {
                "id": campaign_id_for(members),
                "member_count": len(member_ads),
                "high_risk_count": high_risk,
                "max_risk_score": max(ad.risk_score for ad in member_ads),
                "member_ids": [ad.id for ad in member_ads],
                "label": f"Potentially coordinated cluster ({len(member_ads)} ads)",
            }
        )
    return campaigns


def get_campaign(db: Session, campaign_id: str) -> dict | None:
    for campaign in list_campaigns(db):
        if campaign["id"] == campaign_id:
            return campaign
    return None


def related_ids(db: Session, advertisement_id: str) -> set[str]:
    ids: set[str] = set()
    rels = db.query(AdvertisementRelationship).filter(
        (AdvertisementRelationship.source_ad_id == advertisement_id)
        | (AdvertisementRelationship.target_ad_id == advertisement_id)
    ).all()
    for rel in rels:
        ids.add(rel.source_ad_id if rel.source_ad_id != advertisement_id else rel.target_ad_id)
    return ids
