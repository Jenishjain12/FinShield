# Architecture

FIN-SHIELD is a modular monolith.

```
frontend (Vite + React + TypeScript)
        REST JSON
backend (FastAPI + SQLAlchemy + SQLite)
        services: extraction, risk, matching, campaigns, alerts, OCR
```

## Backend modules

- `app/api` — HTTP routes
- `app/services/extraction.py` — regex/rule entity extraction
- `app/services/risk.py` — 0–100 rules-based triage score
- `app/services/matching.py` — shared-entity edges and text similarity
- `app/services/analysis.py` — orchestration: OCR → extract → match → score → alerts
- `app/services/campaigns.py` — connected-component clusters
- `app/services/ocr.py` — optional pytesseract; reports unavailability honestly

## Data model

Advertisement, ExtractedEntity, RiskSignal, AdvertisementRelationship, Alert, AnalystNote.

Relationships are stored with type, evidence, explanation, and optional similarity score. Campaigns are derived, not manually assigned.

## Security posture (MVP)

- Uploaded images are type- and size-validated and not executed.
- User-supplied URLs are not fetched.
- Account-like values can be masked in the UI.
- Configuration is environment-based.
- Unhandled exceptions return a generic error body.
