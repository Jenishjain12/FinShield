# FIN-SHIELD — Real-Time UPI & Digital Payment Anomaly Detection Platform

FIN-SHIELD is an investigative triage platform for monitoring, detecting, and exploring risk signals in simulated UPI (Unified Payments Interface) and digital payment transactions in near real time.

It is an **investigation and risk-triage tool**. It does not pronounce a transaction or user definitely fraudulent or criminal. All anomaly scores, rule hits, alerts, and risk clusters are framed as explainable indicators requiring human review.

The default dataset is **100% synthetic demonstration data**, clearly labelled across all views.

---

## Key Capabilities

1. **UPI-Specific Anomaly & Risk Patterns**:
   - **Fake Collect Requests**: Detection of collect/pull requests disguised as lottery winnings, cashback, or refunds.
   - **Phishing Payment Handles**: Identification of handles impersonating trusted banks, utilities, or payment gateways (e.g. `sbi.kyc@paytm`, `electricity.desk@upi`).
   - **Mule Account Fan-Out**: Detection of rapid in-and-out fund movement (credits followed by immediate transfers).
   - **Velocity Spikes**: Sudden frequency bursts exceeding baseline norms.
   - **First-Time Beneficiary + High Value**: Uncharacteristic large transfers to unverified accounts.
   - **Device & IP Sharing Rings**: Detection of multiple unrelated accounts transacting from the same synthetic device fingerprint.
   - **Structured Round Amounts**: Detection of patterned round transfers often seen in extortion or scam payment schedules.

2. **Dual-Layer Explainable Scoring Engine**:
   - **Unsupervised Machine Learning**: Scikit-Learn `IsolationForest` pipeline modeling multivariate transaction anomalies.
   - **Deterministic Companion Rules**: Explicit, transparent rule contributions detailing exact reasons and score deltas.
   - **Graceful Fallback**: Transparently defaults to deterministic rules if the ML model is uninitialized.

3. **Kafka-Like Stream Simulator**:
   - In-memory event stream simulating real-time payment ingestion.
   - Real-time Server-Sent Events (SSE) broadcasting transactions, feature vectors, and anomaly flags to the frontend.
   - Lifecycle controls: `Start`, `Pause`, `Resume`, `Stop`, and `Reset`.

4. **Forensic Network & Pattern Observatory**:
   - Interactive 2D/3D entity graph mapping accounts, UPI handles, devices, and fund flows.
   - Slide-over Case Dossier for one-click human disposition stamping (`Unreviewed`, `Under Review`, `Escalated`, `Closed`).

---

## Architecture

- **Backend**: Python 3.12, FastAPI, SQLAlchemy, SQLite (`data/finshield.db`), Scikit-Learn.
- **Frontend**: Vite, React 18, TypeScript, Tailwind CSS, Recharts, React Flow (`@xyflow/react`), Three.js / React Three Fiber (`@react-three/fiber`, `@react-three/drei`).
- **Data**: Synthetic generator creating realistic Indian digital banking topologies.

---

## Setup & Installation

### Prerequisites
- Python 3.12 (Homebrew: `brew install python@3.12`)
- Node.js 20+

### Backend Setup

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Configure `.env` (optional, defaults provided):
```bash
cp .env.example .env
```

### Frontend Setup

```bash
cd frontend
npm install
```

---

## Seed Synthetic Data & Train Anomaly Model

Run the synthetic data generator and train the Isolation Forest anomaly pipeline:

```bash
cd backend
source .venv/bin/activate
python seed.py
```

This generates:
- 500+ synthetic customer accounts & device fingerprints.
- Realistic transaction baselines with embedded UPI risk patterns (fake collects, mule networks, velocity bursts).
- Trains and persists the `IsolationForest` anomaly model artifact.

---

## Running the Platform

### Terminal 1: Backend API

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Backend Swagger Docs: `http://localhost:8000/docs`

### Terminal 2: Frontend Observatory

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Testing

### Backend Unit & Integration Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

### Frontend Production Build

```bash
cd frontend
npm run build
```

---

## Security & Privacy Compliance

- **Synthetic Only**: Uses purely generated synthetic Indian banking identifiers.
- **No External URL Fetching**: URLs and handles are parsed strictly as offline text tokens.
- **Zero Secrets in Repo**: All API keys, environment credentials, and tokens are excluded via `.gitignore`.
- **Explainability First**: Scores represent risk triage priority (0–100), not statistical proof of crime.
