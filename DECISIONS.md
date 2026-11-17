# Procurement System Design & Business Decisions (DECISIONS.md)

**Project:** Corvo Engineering Autonomous PR-to-PO Decision Engine  
**Author:** Full-Stack Engineering Candidate  
**Date:** November 2026  
**Policy Version Applied:** Corvo Procurement Policy v5.0 (Document `CORVO-PROC-POL-04`)

---

## 1. Executive Summary & Objective

The Corvo Procurement Engine automates the evaluation of factory Purchase Requisitions (PRs) into either Purchase Orders (POs) or Sourcing Requests (RFQs, RFPs, Capex, New Item).

This document details all business decisions, mathematical formulations, and engineering trade-offs where the Procurement Policy v5.0 is silent or requires concrete implementation choices.

---

## 2. Item Matching & Resolution (Policy Section 1)

### 2.1 The Problem
Requisitioners enter free-text descriptions with factory shorthand, typos, noise phrases, and missing item codes (39 out of 186 lines in `sample_pr_batch.csv`).

### 2.2 Our Implementation Decisions
1. **Supplied Item Code Priority:** When a valid item code is provided and exists in `item_master`, it is accepted immediately.
2. **Noise Phrase Filtering:** Descriptions often include contextual notes that pollute text matching. We strip:
   - Maintenance markers: `for maintenance`, `urgent`, `- urgent`, `as per sample`, `(repeat)`, `(quarterly)`
3. **Abbreviation Normalization:** Factory vocabulary is standardized:
   - `brg` → `bearing` / `ball bearing`
   - `pneu` → `pneumatic`
   - `hyd` → `hydraulic`
   - `welding rod` → `welding electrode`
   - `24"` → `24 inch`
   - `v-belt` → `V-belt`
4. **Token F1 Similarity Metric:** We compute harmonic token overlap (F1) against all 73 item master descriptions. A threshold of `>= 0.70` is required to match.
5. **Unmatched / New Items (`NEW`):** 
   - Items with similarity `< 0.70` (e.g. `Drinking water purifier 50 LPH` and `Ultrasonic thickness gauge`) are designated as `resolved_item_code = NEW`.
   - Per Policy 1.2, new items are routed to `NEW_ITEM_SOURCING`, valued at `quantity × estimated_unit_price`, are never clubbed, and receive zero suggested suppliers.

---

## 3. Requirement Clubbing (Policy Section 2)

### 3.1 Rules Applied
- Lines are sorted by `(created_at, pr_no, pr_line)` to ensure deterministic ordering.
- A PR line joins an existing requirement if and only if:
  1. Same resolved item code (`res_code != "NEW"`).
  2. Same manufacturing plant (`PUN1` vs `CHK1`).
  3. Created within **14 calendar days** of the requirement's first line: `0 <= (line.created_at - req.first_created_at).days <= 14`.
  4. Need-by date within **7 calendar days** (either side) of the requirement's first line need-by date: `abs((line.need_by_date - req.first_need_by_date).days) <= 7`.
- **Earliest Group Rule:** If a line qualifies for multiple open requirements, it joins the earliest requirement by creation time.
- **Emergency Escalation:** If any line in a clubbed requirement is marked `Emergency`, the entire requirement inherits `is_emergency = True`.

### 3.2 Worked Example Validations
- **Worked Example 5:** PR-26-00146, PR-26-00144, PR-26-00145 (all CHK1, Hydraulic oil HLP 68, created within 14 days, need-by within 7 days) → Clubbed into one requirement (`REQ-0001`, Total Qty: 760 LTR, Value: ₹1,26,472 → `SPOT_PO`).
- **Worked Example 6:** PR-26-00106 (PUN1) and PR-26-00103 (CHK1) for VCI bags → **Not clubbed** because plants differ. Each evaluated on its own value.

---

## 4. Valuation Hierarchy & Out-of-Ceiling Pricing (Policy Section 3)

### 4.1 Valuation Sequence
Requirement value is calculated as `total_quantity × unit_price`, where `unit_price` follows the policy hierarchy:
1. **Usable Rate Contract Rate:** The rate of the lowest-priced valid contract with sufficient remaining ceiling headroom.
2. **Out-of-Ceiling Contract Rate:** If all applicable contracts are valid but have exhausted their value ceiling, the requirement is valued at the **lowest applicable contract rate** (Policy 3.1a).
3. **Historical PO Price:** If no contracts apply, the unit price from the most recent PO for the item placed in the **365 days** prior to the requirement date.
4. **Item Master Standard Price:** If no PO history exists in 365 days, the standard catalog price.

### 4.2 Worked Example Validation
- **Worked Example 3:** Bearings for CHK1 (`REQ-0008`, 380 NOS Ball bearing 6308-ZZ). Contract `RC-2026-002` had only ₹38,000 ceiling remaining against a requirement value of ₹2,20,256. The contract could not be used, but the requirement was valued at the contract rate (₹579.62), resulting in ₹2,20,256, which triggered `RFQ` (between 2L and 10L).

---

## 5. Contract Ceilings & Chronological Consumption (Policy Section 4)

### 5.1 Ceiling Tracking
- Rate contracts signed before 31 October 2026 start with `consumed_value` from the register.
- Contracts signed after the register update (PDF-only contracts `RC-2026-031` and `RC-2026-033`) start with `consumed_value = 0.0`.
- Requirements consume ceiling in **strict order of requirement date** (Policy 4.2).
- When a requirement is awarded `CONTRACT_PO`, the contract's consumed value is incremented by `requirement_value`.

### 5.2 Multiple Contracts & Rate Tie-Breaking
- If multiple rate contracts cover an item, the engine selects the one with the lowest unit rate that has sufficient headroom (Policy 4.3).
- **Worked Example 4:** Hex bolts M10x40 (`ITM-1009`) are covered by `RC-2026-015` (Unbrako, rate ₹6.00) and `RC-2026-013` (Precision Fasteners, rate ₹7.00). Because `RC-2026-015` only had ₹12,000 ceiling left, the engine selected `RC-2026-013` (Supplier S007).

---

## 6. Preferred Supplier Ranking System (Policy Section 6)

### 6.1 Formula Architecture
Policy 6.2 mandates ranking based on purchase frequency, recency, contract history, on-time delivery %, and quality rating.

We defined an explainable, linear composite scoring function:
$$\text{Score} = (0.30 \times S_{\text{freq}}) + (0.25 \times S_{\text{rec}}) + (0.20 \times S_{\text{con}}) + (0.15 \times S_{\text{otd}}) + (0.10 \times S_{\text{qual}})$$

Where:
- $S_{\text{freq}} = \min(\text{PO\_count} / 10.0, 1.0)$ (PO count in the last 548 days, normalized up to 10 POs)
- $S_{\text{rec}} \in \{1.0, 0.5, 0.0\}$ (1.0 if most recent PO $\le 90$ days; 0.5 if $\le 365$ days; 0.0 otherwise)
- $S_{\text{con}} \in \{1.0, 0.0\}$ (1.0 if supplier has held a contract for the item on or before the date)
- $S_{\text{otd}} = \text{on\_time\_pct} / 100.0$ (from Supplier Master)
- $S_{\text{qual}} = \text{quality\_rating} / 5.0$ (from Supplier Master)

### 6.2 Reference Price Determination (Section 6.3)
1. Most recent PO unit price from that supplier for the item in 548 days.
2. If none, the rate in that supplier's most recent contract covering the item.
3. If none, the item master standard price.

### 6.3 Sourcing Suggestions & Category Fallback (Section 6.4)
- When the preferred list has fewer than the required number (3 for RFQ, 5 for RFP/Capex), active suppliers who list the item's category in `supplier_master` are added.
- Category suppliers are ranked by best performance record:
  $$\text{Category Score} = (0.60 \times (\text{quality\_rating} / 5.0)) + (0.40 \times (\text{on\_time\_pct} / 100.0))$$
- Blocked (`S004`) and Inactive (`S031`) suppliers are strictly excluded from all POs and sourcing suggestions.

---

## 7. Purchase Order Consolidation (Policy Section 7)

- Requirements ending in POs are consolidated into one PO with multiple line items when:
  1. Same supplier ID.
  2. Same plant (`PUN1` or `CHK1`).
  3. Same procurement route (`CONTRACT_PO`, `SPOT_PO`, `EMERGENCY_PO`).
  4. Raised within **24 hours** of the first requirement on that PO (measured from creation time of each requirement's first line).
- Requirements join the earliest open qualifying PO.
- Sourcing requests (`RFQ`, `RFP`, `CAPEX_SOURCING`, `NEW_ITEM_SOURCING`) are **never consolidated**.

---

## 8. Policy as Data & Amendment Handling (Section 5)

- Procurement rules (thresholds, windows, priorities) are stored in the database as versioned JSON records with effective dates.
- When an amendment is uploaded or pasted, Google Gemini extracts the structured parameters and generates a plain-language summary for the buyer.
- On approval, the amendment is activated with an effective date.
- The decision engine dynamically selects the policy version corresponding to the requirement date, allowing historical re-processing and future-dated policies without code modifications.

---

## 9. Architectural Integrity

- **Router → Controller → Repository Architecture:**
  - Routers handle HTTP protocol, validation, and status codes.
  - Controllers orchestrate business logic and engine execution.
  - Repositories exclusively interact with SQLAlchemy and database sessions.
- **Deterministic Procurement Core:**
  - AI is strictly used for language extraction (chat intake) and amendment parsing.
  - All procurement decisions (routing, clubbing, valuation, PO creation) remain 100% deterministic, auditable, and rule-driven.
