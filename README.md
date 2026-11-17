# Corvo Engineering Autonomous PR-to-PO Decision Engine

> **Cantill.ai Full-Stack Intern Technical Assessment**  
> An autonomous, policy-driven procurement engine that ingests Purchase Requisitions (PRs), clubs demand, values requirements, enforces contract ceilings, ranks suppliers, and automatically generates Purchase Orders (POs) or Sourcing Requests (RFQs/RFPs).

---

## 🚀 Key Features

1. **Deterministic PR-to-PO Decision Engine:**
   - Evaluates requirements against **Corvo Procurement Policy v5.0** (Rules 5.1–5.6).
   - Ingests free-text PRs with shorthand normalization, noise stripping, and token F1 matching (`>= 0.70` or `NEW`).
   - Chronological demand clubbing (same item, same plant, 14-day creation window, ±7-day need-by date).
   - Strict valuation hierarchy: Usable Rate Contract $\to$ Out-of-Ceiling Rate $\to$ 365-day PO History $\to$ Catalog Price.
   - Chronological contract ceiling consumption with multi-contract rate tie-breaking.
   - Purchase order consolidation for identical supplier, plant, route within a 24-hour window.
   - Batch evaluation exporting the exact 13-column specification format.

2. **Conversational Requisition Intake (Chat Interface):**
   - Natural language conversational intake powered by **Google Gemini 2.5 Flash**.
   - Extracts item, quantity, plant, need-by date, and urgency with interactive confirmation.
   - Automatic routing evaluation with real-time feedback to requisitioners.

3. **Versioned Policy Management ("Policy as Data"):**
   - Policies and thresholds stored dynamically in PostgreSQL / SQLite (`policies` & `policy_rules`).
   - Zero-downtime policy amendments with Gemini-powered plain-language impact summaries and visual diffs.
   - Supports drafting, previewing, and activating amendments without code redeployment.

4. **Preferred Supplier Ranking Engine:**
   - Multi-factor composite scoring:
     $$\text{Score} = (0.30 \times S_{\text{freq}}) + (0.25 \times S_{\text{rec}}) + (0.20 \times S_{\text{con}}) + (0.15 \times S_{\text{otd}}) + (0.10 \times S_{\text{qual}})$$
   - Transparent sub-score breakdowns and category-level fallback recommendations.
   - Tested and verified against Corvo Worked Examples (ITM-1048, ITM-1036, ITM-1016).

5. **Contract Management & PDF Ingestion:**
   - Live tracking of contract ceilings and consumed amounts.
   - Automated PyMuPDF extraction for rate contracts uploaded as PDFs (e.g., `RC-2026-031`, `RC-2026-033`).

6. **Buyer Workspace & Audit Trail:**
   - Filterable buyer queue with one-click PO approvals and overrides with mandatory written justifications.
   - Tamper-evident audit trail capturing every automated routing decision and buyer intervention.

---

## 🏛️ System Architecture

Built using the **Router-Controller-Repository** design pattern for separation of concerns and maintainability:

```
frontend/ (Next.js 14 App Router, TypeScript, Tailwind CSS)
   │
   ▼ HTTP REST
backend/
 ├── app/api/endpoints/       # API Routers (HTTP validation, response models)
 ├── app/controllers/         # Controllers (Business workflows & orchestration)
 ├── app/repositories/        # Repositories (Database access & SQLAlchemy queries)
 ├── app/services/ai_store.py # Centralized Gemini 2.5 Flash service
 ├── app/models/              # SQLAlchemy Database Models
 ├── app/core/                # Database engine, Alembic config, settings
 └── app/data/                # Corvo master datasets & PDF contracts
```

For full architecture details, see [APPROACH.md](APPROACH.md).  
For procurement policy decisions and edge-case handling, see [DECISIONS.md](DECISIONS.md).

---

## 🛠️ Quick Start (Running Locally)

### Option A: One-Command Docker Setup (Recommended)

Make sure you have Docker and Docker Compose installed:

```bash
docker compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend API & Swagger UI:** http://localhost:8000/docs
- **PostgreSQL Database:** localhost:5433

---

### Option B: Direct Local Setup (Without Docker)

#### 1. Backend Setup (FastAPI)

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Set your Gemini API key in backend/.env:
# GEMINI_API_KEY=your_key_here

# Run the API server (uses SQLite fallback automatically if PostgreSQL is not active)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The database initializes and automatically imports all 73 items, 48 suppliers, 2 plants, 468 historical POs, 10 register contracts, and 2 PDF contracts on first startup.

#### 2. Frontend Setup (Next.js 14)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit **http://localhost:3000** in your browser.

---

## 🧪 Running Automated Tests

Run the test suite using `pytest` inside the backend directory:

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

### Test Coverage Highlights:
- **14/14 Worked Examples:** Verifies exact routing, valuation, and clubbing outcomes from Corvo Engineering policy examples.
- **Supplier Ranking Formula:** Verifies composite weights and rank ordering against Worked Examples (ITM-1048, ITM-1036, ITM-1016).
- **Contract Ceiling Depletion:** Tests that out-of-ceiling contracts revert to RFQ without under-pricing.
- **Chat Conversational Intake:** Tests parameter extraction and PR creation flow.
- **Policy Amendment Workflow:** Tests drafting, AI diff preview, and runtime rule activation.
- **Buyer Workspace:** Tests buyer approval, override reasons, and audit logging.

---

## 📡 Key API Endpoints

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Batch Engine** | `POST` | `/api/v1/process-batch` | Process PR lines and return 13-column evaluation schema |
| | `GET` | `/api/v1/export-sample` | Download sample PR batch evaluation as CSV |
| **Chat Intake** | `POST` | `/api/v1/chat/message` | Conversational intake and parameter extraction |
| | `POST` | `/api/v1/chat/confirm` | Confirm extracted PR and run immediate evaluation |
| **Suppliers** | `GET` | `/api/v1/rankings` | Get ranked suppliers for an item as of date |
| | `GET` | `/api/v1/rankings/suggestions`| Sourcing suggestions (top suppliers + category fallback) |
| | `GET` | `/api/v1/rankings/export` | Download supplier rankings as CSV |
| **Policies** | `GET` | `/api/v1/policies/active` | Get active procurement policy rules |
| | `POST` | `/api/v1/policies/draft-from-amendment` | AI-assisted draft amendment with diff preview |
| | `POST` | `/api/v1/policies/{id}/activate` | Activate draft policy version |
| **Contracts** | `GET` | `/api/v1/contracts` | List all contracts with remaining ceiling |
| | `POST` | `/api/v1/contracts/upload-pdf` | Ingest and parse PDF contract document |
| **Buyer** | `GET` | `/api/v1/buyer/requirements` | List requirements awaiting review or approved |
| | `POST` | `/api/v1/buyer/requirements/{id}/approve` | Approve automated decision |
| | `POST` | `/api/v1/buyer/requirements/{id}/override` | Buyer override with mandatory written justification |
| | `GET` | `/api/v1/buyer/audit-logs` | Retrieve chronological audit trail |

---

## 📄 License & Credits
Developed for the **Cantill.ai Full-Stack Intern Technical Assessment** (Corvo Engineering Case Study).
