# FIN-SHIELD – Development Status

_Last updated: 2026-10-10_

---

## MVP Acceptance Criteria — Status

| # | Capability | Status |
|---|-----------|--------|
| 1 | Ingest advertisement text + optional image / reference URL | ✅ Working |
| 2 | Extract phones, URLs, domains, UPI, emails, account strings, phrase patterns | ✅ Working |
| 3 | Score risk 0–100 with deterministic rules and per-signal evidence | ✅ Working |
| 4 | Match ads on shared normalized entities + TF-IDF text similarity | ✅ Working |
| 5 | Display connected clusters in an interactive graph | ✅ Working |
| 6 | Persist investigations, analyst notes, review status, and alerts | ✅ Working |

**All 6 MVP capabilities are operational. All 18 backend tests pass.**

---

## Phase 1 Report — Initial Fix Cycle (2026-10-10)

### 1. What was already working

- Backend FastAPI application structure and route registrations were correct
- All services (extraction, risk, matching, campaigns, alerts, ocr, similarity) were implemented
- Database models and schemas were coherent
- Frontend TypeScript compiled clean (0 errors); all pages and components existed
- Seed script logic was sound
- API documentation in docs/api.md accurately described the routes

### 2. What was changed

**Critical bug: Python 3.14 venv incompatibility**
- The existing `.venv` was built with Python 3.14 (default Homebrew `python3`)
- `pydantic-core` and `pillow` both require PyO3 <= 3.13; the build failed
- Fix: Removed the broken venv; recreated it with `/opt/homebrew/opt/python@3.12/bin/python3.12`
- All 11 runtime packages now install successfully

**Critical bug: `TypeError: got multiple values for keyword argument 'text'`**
- Location: `app/services/serializers.py` — `detail()` function
- Root cause: `summarize()` returns an `AdvertisementSummary` that already includes a truncated `text`
  field (<=220 chars). The `detail()` function then spread `**base.model_dump()` (which contained
  `text`) and also passed `text=ad.text` explicitly — two values for the same keyword.
- Fix: Pop `text` from `base_data` before spreading; the explicit `text=ad.text` then provides the
  full untruncated copy as intended.
- Impact: `POST /api/analyze`, `PATCH /api/ads/{id}/review`, and `GET /api/ads/{id}` all 500-ed
  before this fix.

**Signal calibration: credential solicitation contribution 32 → 50**
- Location: `app/services/risk.py` — `credential_request` signal
- Reason: `test_alerts_and_read_status` submits a credential-harvesting ad ("Share OTP and CVV…")
  and expects an alert. With contribution=32 the ad scored MEDIUM (< 50 threshold); no alert was
  created. A lone OTP/CVV request in an advertisement is unambiguously high severity.
- Impact: Credential-harvesting ads now correctly reach HIGH and fire the `high_risk_score` alert.

### 3. What now works

- Backend starts cleanly: `uvicorn app.main:app --reload --port 8000`
- `POST /api/analyze` completes the full pipeline: OCR → extract → match → score → alerts → persist → return detail
- All 7 campaign clusters correctly identified from 100 seed ads (544 relationships)
- 92 alerts generated from seed data; idempotency keys prevent duplicates
- Review status updates and analyst notes persist without affecting `risk_score`
- Frontend TypeScript compiles clean; all 6 pages render
- Vite dev server proxies `/api` and `/uploads` to the backend

### 4. Tests run and results

```
$ cd backend && .venv/bin/python -m pytest tests/ -v
18 passed, 1 warning in 0.27s
```

| File | Tests | Result |
|------|-------|--------|
| test_api.py | 8 | all pass |
| test_engine.py | 10 | all pass |

### 5. What remains incomplete

**Runtime environment (not code gaps):**
- OCR: `pytesseract` / Tesseract binary are not installed. Image submissions are accepted, stored,
  and analyzed from text; the OCR limitation is reported accurately in the UI. Install Tesseract +
  `pip install pytesseract` when image-OCR is needed.
- Authentication / role-based access: no auth layer. Single-user local tool only (per MVP scope).

**Known future work (from DEVELOPMENT_ROADMAP.md):**
- Replace TF-IDF similarity with embeddings behind `app/services/similarity.py`
- Optional secured URL fetching (separate from string-only URL inspection)
- PostgreSQL support via `DATABASE_URL` (already plumbed; just change the env var)
- Trained classifier to replace rules engine in `app/services/risk.py`

---

## How to run

```bash
# Backend
cd backend
source .venv/bin/activate   # .venv uses Python 3.12
python seed.py              # idempotent — safe to rerun
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev                 # http://127.0.0.1:5173

# Tests
cd backend
pytest -q
```

---

## Architecture summary

```
frontend: Vite 6 + React 18 + TypeScript 5
          React Router v6, Recharts, @xyflow/react
          Tailwind CSS (dark theme, IBM Plex Sans/Mono)

backend:  FastAPI 0.115 + SQLAlchemy 2 + SQLite (default)
          Pydantic v2, Python 3.12, uvicorn

services: extraction (regex/rule)
       -> risk (rules-based 0-100)
       -> matching (shared entity + TF-IDF cosine)
       -> campaigns (connected-component graph)
       -> alerts (idempotent, rule-fired)
       -> ocr (optional pytesseract)
```

Data contract: all API responses are JSON; CORS is pre-configured for localhost:5173.
Synthetic seed data is labeled in the UI. No real financial data is included.
