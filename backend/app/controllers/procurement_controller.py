import re
import datetime
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from sqlalchemy.orm import Session
from app.models import Item, Policy
from app.repositories import (
    ItemRepository, SupplierRepository, ContractRepository,
    POHistoryRepository, PolicyRepository, DecisionRepository
)
from app.core.config import settings
from app.controllers.ranking_controller import RankingController
from app.services.procurement_engine import normalize_description, parse_line_datetime, parse_line_date

class ProcurementController:
    def __init__(self, db: Session):
        self.db = db
        self.item_repo = ItemRepository(db)
        self.supplier_repo = SupplierRepository(db)
        self.contract_repo = ContractRepository(db)
        self.po_repo = POHistoryRepository(db)
        self.policy_repo = PolicyRepository(db)
        self.decision_repo = DecisionRepository(db)
        self.ranking_controller = RankingController(db)

    def resolve_item(self, input_code: Optional[str], description: str) -> Tuple[str, Optional[Item]]:
        if input_code and str(input_code).strip() and not pd.isna(input_code):
            code = str(input_code).strip()
            item = self.item_repo.get_by_code(code)
            if item:
                return code, item

        desc = str(description).strip()
        norm_desc = normalize_description(desc)

        exact_item = self.item_repo.find_by_description(desc) or self.item_repo.find_by_description(norm_desc)
        if exact_item:
            return exact_item.item_code, exact_item

        all_items = self.item_repo.get_all()
        desc_tokens = set(re.findall(r'[a-z0-9]+', norm_desc))
        best_item = None
        best_score = 0.0

        for item in all_items:
            norm_item_desc = normalize_description(item.description)
            if norm_desc == norm_item_desc:
                return item.item_code, item
            item_tokens = set(re.findall(r'[a-z0-9]+', norm_item_desc))
            inter = desc_tokens.intersection(item_tokens)
            if inter:
                f1 = 2 * len(inter) / (len(desc_tokens) + len(item_tokens))
                if f1 > best_score:
                    best_score = f1
                    best_item = item

        if best_score >= 0.70 and best_item is not None:
            return best_item.item_code, best_item

        return "NEW", None

    def process_batch(self, lines_data: Optional[List[Dict[str, Any]]] = None, policy_override: Optional[Policy] = None, persist: bool = False) -> List[Dict[str, Any]]:
        import os
        if lines_data is None:
            csv_path = os.path.join(settings.DATA_DIR, "pr_batches", "sample_pr_batch.csv")
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path)
                lines_data = df.to_dict(orient="records")
            else:
                lines_data = []

        if not lines_data:
            return []

        # 1. Normalize and resolve lines
        normalized_lines = []
        for idx, l in enumerate(lines_data):
            c_time = parse_line_datetime(l.get("created_at", datetime.datetime.utcnow()))
            need_by = parse_line_date(l.get("need_by_date", c_time.date() + datetime.timedelta(days=14)))
            desc = str(l.get("description", "")).strip()
            in_code = str(l.get("item_code", "")).strip() if l.get("item_code") and not pd.isna(l.get("item_code")) else None

            resolved_code, item_obj = self.resolve_item(in_code, desc)
            qty = float(l.get("quantity", 1.0))
            est_p = float(l["estimated_unit_price"]) if "estimated_unit_price" in l and not pd.isna(l["estimated_unit_price"]) and str(l["estimated_unit_price"]).strip() != "" else None
            urgency = str(l.get("urgency", "Normal")).strip()

            normalized_lines.append({
                "orig_idx": idx,
                "pr_no": str(l.get("pr_no", f"PR-{idx+1:05d}")).strip(),
                "pr_line": int(l.get("pr_line", 1)),
                "created_dt": c_time,
                "need_by_dt": need_by,
                "plant": str(l.get("plant", "PUN1")).strip(),
                "description": desc,
                "input_item_code": in_code,
                "resolved_item_code": resolved_code,
                "item_obj": item_obj,
                "quantity": qty,
                "uom": str(l.get("uom", "NOS")).strip() if l.get("uom") and not pd.isna(l.get("uom")) else "NOS",
                "estimated_unit_price": est_p,
                "urgency": urgency
            })

        normalized_lines.sort(key=lambda x: (x["created_dt"], x["pr_no"], x["pr_line"]))

        ref_date = normalized_lines[0]["created_dt"].date() if normalized_lines else datetime.date.today()
        policy = policy_override or self.policy_repo.get_active_policy(ref_date)
        rules_cfg = policy.rules_config if policy and policy.rules_config else {}
        clubbing_window = rules_cfg.get("clubbing_window_days", 14)
        need_by_window = rules_cfg.get("need_by_window_days", 7)
        pol_version = policy.version if policy else "5.0"

        spot_limit = 200000.0
        emergency_limit = 500000.0
        rfq_limit = 1000000.0
        for r in rules_cfg.get("rules", []):
            r_params = r.get("condition_params", {})
            if r.get("outcome_route") == "SPOT_PO" and "max_value" in r_params:
                spot_limit = float(r_params["max_value"])
            elif r.get("outcome_route") == "EMERGENCY_PO" and "max_value" in r_params:
                emergency_limit = float(r_params["max_value"])
            elif r.get("outcome_route") == "RFQ" and "max_value" in r_params:
                rfq_limit = float(r_params["max_value"])

        # 2. Clubbing
        requirements = []
        line_to_req = {}

        for line in normalized_lines:
            res_code = line["resolved_item_code"]
            plant = line["plant"]
            c_time = line["created_dt"]
            need_by = line["need_by_dt"]
            qty = line["quantity"]
            urgency = line["urgency"]

            joined_req = None
            if res_code != "NEW":
                for req in requirements:
                    if req["resolved_item_code"] == res_code and req["plant"] == plant:
                        diff_days = (c_time.date() - req["first_created_dt"].date()).days
                        need_diff = abs((need_by - req["first_need_by_dt"]).days)
                        if 0 <= diff_days <= clubbing_window and need_diff <= need_by_window:
                            joined_req = req
                            break

            if joined_req is not None:
                joined_req["lines"].append(line)
                joined_req["total_quantity"] += qty
                if urgency == "Emergency":
                    joined_req["is_emergency"] = True
                line_to_req[line["orig_idx"]] = joined_req["group_id"]
            else:
                req_id = f"REQ-{len(requirements)+1:04d}"
                new_req = {
                    "group_id": req_id,
                    "resolved_item_code": res_code,
                    "item_obj": line["item_obj"],
                    "plant": plant,
                    "first_created_dt": c_time,
                    "requirement_date": c_time.date(),
                    "first_need_by_dt": need_by,
                    "total_quantity": qty,
                    "uom": line["uom"],
                    "is_emergency": (urgency == "Emergency"),
                    "lines": [line],
                    "first_est_price": line["estimated_unit_price"]
                }
                requirements.append(new_req)
                line_to_req[line["orig_idx"]] = req_id

        # 3. Valuation & Contracts
        active_suppliers = {s.supplier_id: s for s in self.supplier_repo.get_active()}
        contracts = self.contract_repo.get_all()
        contract_lines = self.contract_repo.get_all_lines()

        c_lines_map: Dict[str, list] = {}
        for cl in contract_lines:
            c_lines_map.setdefault(cl.contract_id, []).append(cl)

        contract_info = {c.contract_id: c for c in contracts}
        contract_consumed = {c.contract_id: (c.consumed_value if c.source_type == "REGISTER" else 0.0) for c in contracts}

        requirements_sorted = sorted(
            requirements,
            key=lambda r: (r["requirement_date"], r["first_created_dt"], r["group_id"])
        )

        req_decisions: Dict[str, Dict[str, Any]] = {}

        for req in requirements_sorted:
            res_code = req["resolved_item_code"]
            req_date = req["requirement_date"]
            total_qty = req["total_quantity"]
            is_emergency = req["is_emergency"]
            group_id = req["group_id"]

            if res_code == "NEW":
                unit_price = req["first_est_price"] or 0.0
                group_value = round(total_qty * unit_price, 2)
                req["unit_price"] = unit_price
                req["group_value_inr"] = group_value
                req["valuation_method"] = "ESTIMATE"
                req_decisions[group_id] = {
                    "group_id": group_id,
                    "decision": "SOURCING_REQUEST",
                    "route": "NEW_ITEM_SOURCING",
                    "supplier_id": None,
                    "unit_price": unit_price,
                    "group_value_inr": group_value,
                    "suggested_supplier_ids": "",
                    "policy_version": pol_version,
                    "clause": "1.2",
                    "reference_doc": None,
                    "reason": "New item not in item master; goes to sourcing at requester estimated price without supplier suggestions."
                }
                continue

            item_obj = req["item_obj"]

            applicable_contracts = []
            for c_id, cl_list in c_lines_map.items():
                c = contract_info[c_id]
                if c.start_date <= req_date <= c.end_date and c.supplier_id in active_suppliers:
                    for cl in cl_list:
                        if cl.item_code == res_code:
                            applicable_contracts.append({
                                "contract_id": c_id,
                                "supplier_id": c.supplier_id,
                                "supplier_name": c.supplier_name,
                                "rate": cl.rate,
                                "ceiling": c.value_cap,
                                "consumed": contract_consumed[c_id]
                            })

            usable_contract = None
            if applicable_contracts:
                applicable_contracts.sort(key=lambda x: (x["rate"], x["contract_id"]))
                for ac in applicable_contracts:
                    if ac["consumed"] + (total_qty * ac["rate"]) <= ac["ceiling"]:
                        usable_contract = ac
                        break

            if usable_contract is not None:
                unit_price = usable_contract["rate"]
                valuation_method = "CONTRACT_RATE"
            elif applicable_contracts:
                unit_price = min(ac["rate"] for ac in applicable_contracts)
                valuation_method = "OUT_OF_CEILING_CONTRACT"
            else:
                recent_pos = self.po_repo.get_by_item(res_code, req_date, days_window=365)
                if recent_pos:
                    unit_price = recent_pos[0].unit_price
                    valuation_method = "PO_HISTORY"
                else:
                    unit_price = item_obj.standard_price if item_obj else 0.0
                    valuation_method = "STANDARD_PRICE"

            group_value = round(total_qty * unit_price, 2)
            req["unit_price"] = unit_price
            req["group_value_inr"] = group_value
            req["valuation_method"] = valuation_method

            active_recent_po = self.po_repo.get_recent_active_po(res_code, req_date, days_window=365)
            has_active_recent_purchase = (active_recent_po is not None)

            # Decision rules in order
            if item_obj and item_obj.item_type == "Capex":
                sugg = self.ranking_controller.get_sourcing_suggestions(res_code, req_date, 5)
                req_decisions[group_id] = {
                    "group_id": group_id,
                    "decision": "SOURCING_REQUEST",
                    "route": "CAPEX_SOURCING",
                    "supplier_id": None,
                    "unit_price": unit_price,
                    "group_value_inr": group_value,
                    "suggested_supplier_ids": ";".join(sugg),
                    "policy_version": pol_version,
                    "clause": "5.1",
                    "reference_doc": None,
                    "reason": "Item type is Capex. Requires Capex approval; 5 suppliers suggested from preferred list and category."
                }
            elif usable_contract is not None:
                c_id = usable_contract["contract_id"]
                contract_consumed[c_id] += total_qty * usable_contract["rate"]
                req_decisions[group_id] = {
                    "group_id": group_id,
                    "decision": "PO",
                    "route": "CONTRACT_PO",
                    "supplier_id": usable_contract["supplier_id"],
                    "unit_price": round(usable_contract["rate"], 2),
                    "group_value_inr": group_value,
                    "suggested_supplier_ids": "",
                    "policy_version": pol_version,
                    "clause": "5.2",
                    "reference_doc": c_id,
                    "reason": f"Contract PO against {c_id} with {usable_contract['supplier_name']} at rate INR {usable_contract['rate']:,.2f}; ceiling has room."
                }
            elif is_emergency and group_value <= emergency_limit and has_active_recent_purchase:
                pref = self.ranking_controller.get_preferred_suppliers(res_code, req_date, top_n=1)
                top_supp = pref[0] if pref else None
                s_id = top_supp["supplier_id"] if top_supp else None
                p_price = top_supp["reference_price"] if top_supp else unit_price
                req_decisions[group_id] = {
                    "group_id": group_id,
                    "decision": "PO",
                    "route": "EMERGENCY_PO",
                    "supplier_id": s_id,
                    "unit_price": p_price,
                    "group_value_inr": group_value,
                    "suggested_supplier_ids": "",
                    "policy_version": pol_version,
                    "clause": "5.3",
                    "reference_doc": f"PO history ({active_recent_po.po_number})",
                    "reason": f"Emergency PO for value INR {group_value:,.2f} <= ₹{emergency_limit:,.0f} to 1st preferred supplier {s_id}."
                }
            elif group_value < spot_limit and has_active_recent_purchase:
                pref = self.ranking_controller.get_preferred_suppliers(res_code, req_date, top_n=1)
                top_supp = pref[0] if pref else None
                s_id = top_supp["supplier_id"] if top_supp else None
                p_price = top_supp["reference_price"] if top_supp else unit_price
                req_decisions[group_id] = {
                    "group_id": group_id,
                    "decision": "PO",
                    "route": "SPOT_PO",
                    "supplier_id": s_id,
                    "unit_price": p_price,
                    "group_value_inr": group_value,
                    "suggested_supplier_ids": "",
                    "policy_version": pol_version,
                    "clause": "5.4",
                    "reference_doc": f"PO history ({active_recent_po.po_number})",
                    "reason": f"Spot PO for value INR {group_value:,.2f} < ₹{spot_limit:,.0f} to 1st preferred supplier {s_id}."
                }
            elif group_value < rfq_limit:
                sugg = self.ranking_controller.get_sourcing_suggestions(res_code, req_date, 3)
                req_decisions[group_id] = {
                    "group_id": group_id,
                    "decision": "SOURCING_REQUEST",
                    "route": "RFQ",
                    "supplier_id": None,
                    "unit_price": unit_price,
                    "group_value_inr": group_value,
                    "suggested_supplier_ids": ";".join(sugg),
                    "policy_version": pol_version,
                    "clause": "5.5",
                    "reference_doc": None,
                    "reason": f"RFQ for value INR {group_value:,.2f} < ₹{rfq_limit:,.0f}. 3 suppliers suggested."
                }
            else:
                sugg = self.ranking_controller.get_sourcing_suggestions(res_code, req_date, 5)
                req_decisions[group_id] = {
                    "group_id": group_id,
                    "decision": "SOURCING_REQUEST",
                    "route": "RFP",
                    "supplier_id": None,
                    "unit_price": unit_price,
                    "group_value_inr": group_value,
                    "suggested_supplier_ids": ";".join(sugg),
                    "policy_version": pol_version,
                    "clause": "5.6",
                    "reference_doc": None,
                    "reason": f"RFP for value INR {group_value:,.2f} >= ₹{rfq_limit:,.0f}. Formal RFP with 5 suggested suppliers."
                }

        # 4. PO Consolidation
        po_requirements = [r for r in requirements if req_decisions[r["group_id"]]["decision"] == "PO"]
        po_requirements.sort(key=lambda r: r["first_created_dt"])

        consolidated_pos = []
        req_to_po: Dict[str, str] = {}
        po_counter = 1

        for req in po_requirements:
            d = req_decisions[req["group_id"]]
            s_id = d["supplier_id"]
            plant = req["plant"]
            route = d["route"]
            c_time = req["first_created_dt"]

            joined_po = None
            for po in consolidated_pos:
                if po["supplier_id"] == s_id and po["plant"] == plant and po["route"] == route:
                    diff_hours = (c_time - po["first_created_dt"]).total_seconds() / 3600.0
                    if 0 <= diff_hours <= 24.0:
                        joined_po = po
                        break

            if joined_po is not None:
                joined_po["requirements"].append(req["group_id"])
                req_to_po[req["group_id"]] = joined_po["po_id"]
            else:
                po_id = f"PO-{po_counter:04d}"
                po_counter += 1
                new_po = {
                    "po_id": po_id,
                    "supplier_id": s_id,
                    "plant": plant,
                    "route": route,
                    "first_created_dt": c_time,
                    "requirements": [req["group_id"]]
                }
                consolidated_pos.append(new_po)
                req_to_po[req["group_id"]] = po_id

        # Optionally persist into database
        if persist:
            for po in consolidated_pos:
                self.decision_repo.upsert_consolidated_po(
                    po_id=po["po_id"],
                    supplier_id=po["supplier_id"],
                    plant=po["plant"],
                    route=po["route"],
                    first_requirement_time=po["first_created_dt"]
                )
            for req in requirements:
                d = req_decisions[req["group_id"]]
                po_id = req_to_po.get(req["group_id"]) if d["decision"] == "PO" else None
                self.decision_repo.upsert_requirement(
                    group_id=req["group_id"],
                    resolved_item_code=req["resolved_item_code"],
                    plant=req["plant"],
                    total_quantity=req["total_quantity"],
                    unit_price=req["unit_price"],
                    group_value_inr=req["group_value_inr"],
                    valuation_method=req.get("valuation_method", "STANDARD_PRICE"),
                    requirement_date=req["requirement_date"],
                    earliest_need_by=min(l["need_by_dt"] for l in req["lines"]),
                    latest_need_by=max(l["need_by_dt"] for l in req["lines"]),
                    is_emergency=req["is_emergency"],
                    uom=req["uom"]
                )
                self.decision_repo.upsert_decision(
                    group_id=req["group_id"],
                    po_id=po_id,
                    decision=d["decision"],
                    route=d["route"],
                    supplier_id=d["supplier_id"],
                    unit_price=d["unit_price"],
                    group_value_inr=d["group_value_inr"],
                    suggested_supplier_ids=d["suggested_supplier_ids"],
                    policy_version=d["policy_version"],
                    applied_clause=d["clause"],
                    reference_doc=d.get("reference_doc"),
                    reason=d["reason"]
                )

        # 5. Form Output rows
        output_rows = []
        for idx, l in enumerate(lines_data):
            group_id = line_to_req[idx]
            d = req_decisions[group_id]
            norm_line = next(nl for nl in normalized_lines if nl["orig_idx"] == idx)
            po_id = req_to_po.get(group_id, "") if d["decision"] == "PO" else ""

            output_rows.append({
                "pr_no": norm_line["pr_no"],
                "pr_line": norm_line["pr_line"],
                "resolved_item_code": norm_line["resolved_item_code"],
                "group_id": group_id,
                "po_id": po_id,
                "decision": d["decision"],
                "route": d["route"],
                "supplier_id": d["supplier_id"] or "",
                "unit_price": d["unit_price"] if d["unit_price"] is not None else "",
                "group_value_inr": d["group_value_inr"],
                "suggested_supplier_ids": d["suggested_supplier_ids"],
                "policy_version": d["policy_version"],
                "reason": d["reason"],
                "clause": d.get("clause", ""),
                "reference_doc": d.get("reference_doc", "")
            })

        return output_rows
