# FIN-SHIELD API

Base URL (local): `http://127.0.0.1:8000`

All JSON responses. CORS is configured for the Vite dev server.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness |
| GET | `/api/dashboard/summary` | Database-backed dashboard metrics |
| GET | `/api/ads` | Paginated investigations (`q`, `risk`, `review_status`, `page`, `page_size`) |
| GET | `/api/ads/{ad_id}` | Investigation detail |
| POST | `/api/analyze` | `multipart/form-data`: `text`, `source`, `source_url`, `image` |
| GET | `/api/ads/{ad_id}/relationships` | Evidence-backed edges |
| GET | `/api/campaigns` | Connected clusters |
| GET | `/api/campaigns/{campaign_id}` | Cluster members and edges |
| GET | `/api/alerts` | Stored alerts (`unread_only`) |
| PATCH | `/api/alerts/{alert_id}` | `{ "is_read": true }` |
| PATCH | `/api/ads/{ad_id}/review` | `{ "review_status": "unreviewed\|under_review\|escalated\|closed" }` |
| POST | `/api/ads/{ad_id}/notes` | `{ "content": "..." }` |

Review updates do not modify `risk_score`.

Analyze requires text or an image. Images: JPEG/PNG/WebP, max 5 MB. Reference URLs are parsed as strings only.
