# FIN-SHIELD Deployment Guide

This guide details how to deploy FIN-SHIELD for production or live hackathon demonstrations with:
- **Backend**: [Render](https://render.com) (Native Python Web Service, Free Plan)
- **Frontend**: [Vercel](https://vercel.com) (Static Vite Single-Page Application, Free Plan)

---

## Architecture Summary

| Component | Platform | Runtime | Entrypoint / Build |
| :--- | :--- | :--- | :--- |
| **Backend API** | Render | Python 3.12.8 | Build: `pip install -r requirements.txt && python seed.py`<br>Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Frontend UI** | Vercel | Node.js >= 20 | Preset: Vite<br>Root Dir: `frontend`<br>Build: `npm run build`<br>Output: `dist` |

---

## 1. Recommended Deployment Order

Deploying in this exact order prevents CORS and connection errors:

```
[1] Deploy Backend to Render ──> [2] Copy Render Public URL ──> [3] Deploy Frontend to Vercel
                                                                           │
[5] Test Live Application <─── [4] Add Vercel URL to Render CORS <────────┘
```

1. Deploy the backend on Render first.
2. Note the provisioned Render URL (e.g., `https://finshield-api.onrender.com`).
3. Deploy the frontend on Vercel, providing `VITE_API_BASE_URL=https://finshield-api.onrender.com`.
4. Copy the Vercel URL (e.g., `https://finshield.vercel.app`) and configure `CORS_ORIGINS` in the Render service settings.
5. Save changes on Render (which performs a quick restart).

---

## 2. Backend Deployment on Render

### Method A: Blueprint Deployment (Recommended)
FIN-SHIELD includes a root `render.yaml` Blueprint definition.

1. Go to the [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Blueprint**.
2. Connect your GitHub repository (`https://github.com/Jenishjain12/FinShield.git`).
3. Render detects `render.yaml` and provisions the `finshield-api` web service:
   - **Root Directory**: `backend`
   - **Environment**: `python`
   - **Plan**: `free`
   - **Build Command**: `pip install -r requirements.txt && python seed.py`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/api/health`

### Method B: Manual Web Service Setup
If not using Blueprints:
1. Click **New +** > **Web Service**.
2. Connect the repository and configure:
   - **Name**: `finshield-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt && python seed.py`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
3. Under **Advanced** > **Health Check Path**, enter: `/api/health`

### Backend Environment Variables

Configure these in the Render Dashboard (**Environment** tab):

| Variable | Recommended Value / Format | Purpose | Required? |
| :--- | :--- | :--- | :--- |
| `PYTHON_VERSION` | `3.12.8` | Enforces Python 3.12 runtime | Yes |
| `ENVIRONMENT` | `production` | Switches to production security profiles | Yes |
| `CORS_ORIGINS` | `["https://your-frontend.vercel.app"]` | Allowed browser origins (JSON list) | Yes |
| `CORS_ORIGIN_REGEX` | `^https://.*\.vercel\.app$` | Regex allowing dynamic Vercel preview deploys | Optional |
| `NVIDIA_API_KEY` | `nvapi-...` | AI Copilot (NVIDIA NIM inference) | Optional |
| `NVIDIA_MODEL` | `meta/llama-3.1-70b-instruct` | Preferred Copilot model | Optional |
| `NVIDIA_BASE_URL`| `https://integrate.api.nvidia.com/v1` | NVIDIA NIM endpoint | Optional |
| `GEMINI_API_KEY` | `AIza...` | Google Gemini Copilot fallback | Optional |

> [!NOTE]
> `seed.py` executes during every build. It initializes SQLite tables, generates synthetic transactions, and trains the Isolation Forest anomaly model using Render's exact scikit-learn environment, eliminating pickle version mismatches.

---

## 3. Frontend Deployment on Vercel

1. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New...** > **Project**.
2. Import the `FinShield` repository.
3. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click edit and select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://finshield-api.onrender.com` *(Use your actual Render URL with **no trailing slash**)*
5. Click **Deploy**.

Vercel automatically applies `frontend/vercel.json` which provides SPA client-side routing fallback to `/index.html`.

---

## 4. Render Free-Tier Caveats & Solutions

Render's free tier provides a generous sandbox but has specific runtime characteristics:

### 1. Inactivity Spin-Down (Cold Starts)
- **Behavior**: Free web services spin down after 15 minutes of inactivity. The next incoming HTTP request takes **30–50 seconds** to wake the container.
- **Frontend Handling**: FIN-SHIELD has built-in cold start tolerance:
  - An unobtrusive amber telemetry banner (`Waking up the server…`) automatically appears in the UI if `/api/health` takes longer than 3 seconds to respond.
  - The banner automatically retries every 5 seconds and dismisses as soon as the backend responds.
  - Network error toasts advise users: *"FIN-SHIELD backend is unavailable (it may be waking up; retry in about 30 seconds)."*
- **Keep-Warm Recommendation**: For hackathon presentations or live demos, set up a free HTTP ping (e.g., using [cron-job.org](https://cron-job.org/) or [UptimeRobot](https://uptimerobot.com/)) hitting `https://finshield-api.onrender.com/api/health` every **10 minutes**.

### 2. Ephemeral Filesystem
- **Behavior**: Render free instances do not attach persistent disks. Files written to disk reset when the service restarts or spins down.
- **FIN-SHIELD Mitigation**:
  - `seed.py` runs during `buildCommand` and automatically recreates SQLite database tables, synthetic transactions, alerts, and model weights.
  - Core demonstration data is always available on fresh boots.

### 3. Single Worker Process
- **Behavior**: The stream simulator and event dispatch bus operate in-memory (`app/services/stream.py`).
- **Rule**: Never run Uvicorn with `--workers > 1` on Render free tier, as multiple worker processes will not share the stream event state. The start command is preconfigured with a single worker.

---

## 5. Pre-Demo Checklist

Run through this checklist 10 minutes before presenting:

1. **Wake up the backend**:
   Open `https://finshield-api.onrender.com/api/health` in your browser. Wait for the JSON response:
   ```json
   {
     "status": "ok",
     "environment": "production",
     "model_loaded": true,
     "model_version": "isolation_forest_v1.0",
     "sklearn_version": "1.9.1",
     "db_ok": true,
     "copilot_configured": false
   }
   ```
2. **Verify Frontend Connectivity**:
   Open your Vercel URL. Check that no cold-start warning remains and transaction graphs load immediately.
3. **Trigger Transaction Stream Simulator**:
   Navigate to the **Stream** tab and click **Start Simulator** (or send a burst) to confirm real-time Server-Sent Events (SSE) streaming works smoothly over HTTPS.
4. **Inspect Anomaly Details**:
   Click into any transaction in the **Transactions** view or open the **Payer Safeguard** (`/consumer`) to confirm full explainability cards and risk scores render correctly.
