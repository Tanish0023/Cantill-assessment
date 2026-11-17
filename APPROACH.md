# System Architecture & Technical Approach (APPROACH.md)

**Project:** Corvo Engineering Autonomous PR-to-PO Decision Engine  
**Author:** Full-Stack Engineering Candidate  
**Date:** November 2026  
**Architecture Style:** Layered Router-Controller-Repository with Centralized AI Service & Deterministic Procurement Engine

---

## 1. Executive Summary

Corvo Engineering's procurement operations involve evaluating hundreds of Purchase Requisitions (PRs) per plant, navigating complex supplier contracts, managing hard ceiling caps, and adhering to strict delegation-of-power thresholds. 

This document outlines the software engineering approach, architectural decisions, and integration design implemented to build a production-grade, policy-driven procurement engine with a modern web interface.

---

## 2. Core Architectural Principles

### 2.1 Strict Separation of Deterministic Logic and AI Extraction
A fundamental principle of enterprise financial systems is auditability and zero hallucination risk:
- **What AI does (Unstructured Ingestion):**
  1. **Conversational Intake:** Extracts entity attributes (item description, quantity, plant, need-by date, urgency, estimated price) from natural conversational text.
  2. **Policy Amendment Analysis:** Interprets unstructured policy modification memos, generating plain-language impact previews and structured field-level diffs.
- **What AI NEVER does (Deterministic Decision Engine):**
  - AI is **never** permitted to select procurement routes, calculate group values, award suppliers, or modify contract balances.
  - All clubbing, valuation hierarchy, threshold matching (Rules 5.1–5.6), preferred supplier composite scoring, and PO consolidation are executed by deterministic, test-proven Python algorithms.

### 2.2 Router-Controller-Repository Pattern
To guarantee long-term maintainability, testability, and database abstraction, the backend follows the Router-Controller-Repository pattern:

```
[ Frontend (Next.js 14 / Tailwind CSS) ]
                   │
                   ▼  HTTP / REST JSON
[ API Routers (backend/app/api/endpoints/) ]
   - Request validation (Pydantic)
   - Status codes & HTTP header management
                   │
                   ▼  Method Calls
[ Controllers (backend/app/controllers/) ]
   - Workflow orchestration & business rules
   - Coordination between repositories and AI store
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
[ Repositories ]       [ Central AI Store ]
(backend/app/repositories/)  (backend/app/services/ai_store.py)
   - DB Queries (SQLAlchemy)    - Gemini 2.5 Flash SDK
   - Data mutations & entities  - Prompt orchestration & fallback
         │
         ▼
[ Database Engine (PostgreSQL / SQLite fallback) ]
```

1. **API Routers (`backend/app/api/endpoints/`):**
   - Pure HTTP endpoints handling routing, parameter extraction, and status codes.
   - Free of database queries and business logic.
2. **Controllers (`backend/app/controllers/`):**
   - Orchestrate business workflows, coordinate multiple repositories, enforce business invariants, and format data for API responses.
   - Includes `ProcurementController`, `RankingController`, `ChatController`, `PolicyController`, `BuyerController`, `ContractController`, and `DataController`.
3. **Repositories (`backend/app/repositories/`):**
   - The sole layer interacting directly with the database session (`Session`).
   - Encapsulates database models, complex joins, filters, and persistence operations.
   - Includes `ItemRepository`, `SupplierRepository`, `PlantRepository`, `POHistoryRepository`, `ContractRepository`, `PolicyRepository`, `PurchaseRequestRepository`, `DecisionRepository`, and `AuditLogRepository`.
4. **Centralized AI Store (`backend/app/services/ai_store.py`):**
   - All interactions with Large Language Models are isolated in a single, reusable provider module.
   - Powered by Google Gemini (`gemini-2.5-flash`), with model configurations (`GEMINI_MODEL`, `GEMINI_API_KEY`) controlled via `app.core.config.settings`.
   - Swapping models or providers in the future requires editing only `ai_store.py` and `config.py`.

---

## 3. End-to-End Processing Pipelines

### 3.1 Batch Processing Pipeline (`POST /api/process-batch`)
The decision engine transforms a batch of raw PR lines into consolidated POs and Sourcing Requests in five deterministic phases:

```
Raw PR Lines (CSV or DB)
       │
       ▼
1. Item Matching & Resolution (Token F1 >= 0.70 or NEW)
       │
       ▼
2. Chronological Clubbing (Same Item, Plant, 14-day creation window, ±7-day need-by)
       │
       ▼
3. Valuation Hierarchy (Usable Contract -> Out-of-Ceiling Contract -> 365d PO -> Catalog)
       │
       ▼
4. Policy Route Determination (Rules 5.1 - 5.6: PO, RFQ, RFP, Capex)
       │
       ▼
5. PO Consolidation (Same Supplier, Plant, Route, <= 24hr creation window)
       │
       ▼
Final 13-Column Result & DB Persistence
```

1. **Item Resolution:** Shorthand normalization, noise stripping, and token F1 matching against `item_master`. Unmatched descriptions are flagged as `NEW`.
2. **Requirement Clubbing:** PR lines sorted chronologically by creation timestamp. Lines for the same item code and plant are clustered into a unified requirement group if created within 14 calendar days and need-by dates fall within ±7 days.
3. **Valuation:** Each group is priced using the strict hierarchy: valid contract with headroom -> out-of-ceiling contract rate -> most recent PO price in 365 days -> standard catalog price.
4. **Policy Route Evaluation:** Rules 5.1 through 5.6 apply based on item type (Capex vs Opex), group value thresholds (<= 2L, 2L - 10L, > 10L), contract validity, and urgency tags (`Emergency`).
5. **PO Consolidation:** All requirements awarded `CONTRACT_PO` or `SPOT_PO` sharing the same supplier, plant, and route are grouped into a single purchase order if their first lines were created within 24 hours of each other.

### 3.2 Conversational Intake Pipeline (`/api/chat/message` & `/api/chat/confirm`)
1. Requisitioner enters natural conversational text: *"Need 500 ball bearings for Pune line 2 urgently by next Friday"*.
2. `ChatController` calls `ai_store.extract_pr_entities()` with schema instructions and item catalog context.
3. Gemini extracts:
   - `item_description`: `"ball bearings 6205-2RS"`
   - `quantity`: `500`
   - `plant`: `"PUN1"`
   - `need_by_date`: Calculated relative date (YYYY-MM-DD)
   - `urgency`: `"Urgent"` / `"High"`
4. Missing required fields trigger dynamic conversational prompts back to the user.
5. On user confirmation (`/api/chat/confirm`), the controller creates the PR and immediately runs the procurement decision engine to return instant routing decisions.

### 3.3 Versioned Policy Management ("Policy as Data")
Corvo Procurement Policy is stored dynamically in `policies` and `policy_rules` database tables:
- **Drafting & AI Diff:** When management inputs an amendment memo (e.g., *"Raise spot purchase limit from 2L to 3L"*), `PolicyController` uses `ai_store.analyze_policy_amendment()` to generate:
  - Plain-language impact analysis for business stakeholders.
  - Machine-readable diff updating rule parameters (e.g., `rule_5_3_max_value: 300000.0`).
- **Activation:** Draft policies transition to `ACTIVE`, superseding previous versions without requiring server restarts or code deployment.

---

## 4. Frontend Architecture

The user interface is built with **Next.js 14 App Router**, **TypeScript**, and **Tailwind CSS**, organized into an intuitive multi-tab operations center:

1. **Dashboard / Metrics Bar:** Live counters for active PRs, pending approvals, contracts near ceiling, and registered suppliers.
2. **Chat Requisition:** Interactive conversational intake with live parameter extraction preview and one-click submission.
3. **Buyer Workspace:** Filterable inbox of all procurement requirements, detailed evaluation breakdown, one-click Approval, and Policy Override modal requiring written justifications.
4. **Batch Processing:** Instant evaluation of uploaded PR batches with complete 13-column schema export and sample download.
5. **Policy Management:** Version timeline, rule configuration table, and interactive AI Amendment preview console.
6. **Supplier Rankings:** Dynamic ranking calculator supporting any item code and reference date, displaying sub-scores and category fallback suggestions.
7. **Contracts & Ceiling Tracker:** Visual progress bars of consumed vs. remaining ceiling, register vs. PDF source badges, and upload parser for new contracts.
8. **Audit Trail:** Complete chronological event stream tracking every automated decision, buyer approval, and policy override.

---

## 5. Technology Stack Summary

| Layer | Component | Technology | Rationale |
|---|---|---|---|
| **Frontend** | Framework | Next.js 14 (App Router) | High-performance React, modular pages, TypeScript safety |
| | Styling & Icons | Tailwind CSS, Lucide React | Rapid, responsive enterprise design system |
| **Backend** | Framework | FastAPI (Python 3.12) | Asynchronous, auto-documented OpenAPI, high throughput |
| | Architecture | Router-Controller-Repository | Separation of concerns, testability, enterprise maintainability |
| | ORM / DB | SQLAlchemy 2.0 / PostgreSQL | Relational integrity with SQLite zero-config fallback |
| | Schema / Migrations | Alembic | Version-controlled database schema evolution |
| **AI / NLP** | Model | Google Gemini 2.5 Flash | Fast reasoning, structured JSON outputs, zero vendor lock-in |
| | Service Layer | `ai_store.py` | Centralized abstraction layer with automated fallback parsing |
| **Document Parsing** | PDF Contracts | PyMuPDF (`fitz`) | High-speed, local extraction of contract terms and line rates |
| **Deployment** | Containers | Docker & Docker Compose | Multi-container setup (Backend, Frontend, PostgreSQL) |

---

## 6. Verification and Validation

The implementation was validated using comprehensive tests:
- **Worked Examples:** 100% agreement with all 14 official Corvo Engineering worked examples.
- **Supplier Rankings:** Exact score matching for ITM-1048, ITM-1036, and ITM-1016 across all sub-weights.
- **Contract Ceiling Limits:** Rigorous verification that ceiling exhaustion transitions awards from `CONTRACT_PO` to `RFQ` without under-pricing.
- **Audit Logging:** Every user action (approvals, overrides, amendments) is captured with timestamps and user identifiers.
