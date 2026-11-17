import os
import glob
import pandas as pd
from datetime import datetime, date
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import (
    Plant, Item, Supplier, PurchaseOrderHistory,
    Contract, ContractLine, Policy, PolicyRule,
    PurchaseRequest, PRLine, AuditLog
)
from app.services.contract_parser import extract_contract_from_pdf

def parse_date(val):
    if pd.isna(val) or val is None or str(val).strip() == "":
        return None
    val_str = str(val).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y"):
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            pass
    return None

def parse_datetime(val):
    if pd.isna(val) or val is None or str(val).strip() == "":
        return None
    val_str = str(val).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            pass
    return None

def import_all_master_data(db: Session, base_dir: str = None) -> dict:
    if base_dir is None:
        base_dir = settings.DATA_DIR

    results = {}

    # 1. Plants
    plants_csv = os.path.join(base_dir, "master_data", "plants.csv")
    if os.path.exists(plants_csv):
        df_plants = pd.read_csv(plants_csv)
        plant_count = 0
        for _, row in df_plants.iterrows():
            plant_id = str(row["plant"]).strip()
            name = str(row["name"]).strip()
            obj = db.query(Plant).filter_by(plant=plant_id).first()
            if not obj:
                obj = Plant(plant=plant_id, name=name)
                db.add(obj)
            else:
                obj.name = name
            plant_count += 1
        db.commit()
        results["plants"] = plant_count

    # 2. Suppliers
    suppliers_csv = os.path.join(base_dir, "master_data", "supplier_master.csv")
    if os.path.exists(suppliers_csv):
        df_suppliers = pd.read_csv(suppliers_csv)
        supp_count = 0
        for _, row in df_suppliers.iterrows():
            s_id = str(row["supplier_id"]).strip()
            obj = db.query(Supplier).filter_by(supplier_id=s_id).first()
            if not obj:
                obj = Supplier(supplier_id=s_id)
                db.add(obj)
            obj.name = str(row["name"]).strip()
            obj.city = str(row["city"]).strip()
            obj.categories = str(row["categories"]).strip()
            obj.status = str(row["status"]).strip()
            obj.on_time_pct = float(row["on_time_pct"])
            obj.quality_rating = float(row["quality_rating"])
            supp_count += 1
        db.commit()
        results["suppliers"] = supp_count

    # 3. Items
    items_csv = os.path.join(base_dir, "master_data", "item_master.csv")
    if os.path.exists(items_csv):
        df_items = pd.read_csv(items_csv)
        item_count = 0
        for _, row in df_items.iterrows():
            i_code = str(row["item_code"]).strip()
            obj = db.query(Item).filter_by(item_code=i_code).first()
            if not obj:
                obj = Item(item_code=i_code)
                db.add(obj)
            obj.description = str(row["description"]).strip()
            obj.uom = str(row["uom"]).strip()
            obj.category = str(row["category"]).strip()
            obj.item_type = str(row["item_type"]).strip()
            obj.standard_price = float(row["standard_price"])
            item_count += 1
        db.commit()
        results["items"] = item_count

    # 4. PO History
    po_csv = os.path.join(base_dir, "master_data", "po_history.csv")
    if os.path.exists(po_csv):
        df_po = pd.read_csv(po_csv)
        db.query(PurchaseOrderHistory).delete()
        po_count = 0
        for _, row in df_po.iterrows():
            po_date = parse_date(row["po_date"])
            delivered_on_time = True
            if "delivered_on_time" in row and not pd.isna(row["delivered_on_time"]):
                delivered_on_time = str(row["delivered_on_time"]).lower() in ("true", "1", "yes")

            obj = PurchaseOrderHistory(
                po_number=str(row["po_number"]).strip(),
                po_date=po_date,
                supplier_id=str(row["supplier_id"]).strip(),
                item_code=str(row["item_code"]).strip(),
                quantity=float(row["quantity"]),
                uom=str(row["uom"]).strip(),
                unit_price=float(row["unit_price"]),
                plant=str(row["plant"]).strip(),
                delivered_on_time=delivered_on_time
            )
            db.add(obj)
            po_count += 1
        db.commit()
        results["po_history"] = po_count

    # 5. Contracts & Lines
    reg_csv = os.path.join(base_dir, "contracts", "contract_register.csv")
    lines_csv = os.path.join(base_dir, "contracts", "contract_lines.csv")
    pdf_dir = os.path.join(base_dir, "contracts", "pdf")

    registered_ids = set()
    contract_count = 0
    contract_lines_count = 0

    if os.path.exists(reg_csv):
        df_reg = pd.read_csv(reg_csv)
        for _, row in df_reg.iterrows():
            c_id = str(row["contract_id"]).strip()
            registered_ids.add(c_id)
            c_obj = db.query(Contract).filter_by(contract_id=c_id).first()
            if not c_obj:
                c_obj = Contract(contract_id=c_id)
                db.add(c_obj)
            c_obj.supplier_id = str(row["supplier_id"]).strip()
            c_obj.supplier_name = str(row["supplier_name"]).strip()
            c_obj.start_date = parse_date(row["start_date"])
            c_obj.end_date = parse_date(row["end_date"])
            c_obj.value_cap = float(row["value_cap"])
            c_obj.consumed_value = float(row["consumed_value"]) if not pd.isna(row.get("consumed_value")) else 0.0
            c_obj.source_type = "REGISTER"
            
            # Check if PDF exists
            pdf_path = os.path.join(pdf_dir, f"{c_id}.pdf")
            if os.path.exists(pdf_path):
                c_obj.document_path = pdf_path

            contract_count += 1
        db.commit()

    if os.path.exists(lines_csv):
        df_lines = pd.read_csv(lines_csv)
        db.query(ContractLine).delete()
        for _, row in df_lines.iterrows():
            line_obj = ContractLine(
                contract_id=str(row["contract_id"]).strip(),
                item_code=str(row["item_code"]).strip(),
                description=str(row["description"]).strip(),
                uom=str(row["uom"]).strip(),
                rate=float(row["rate"])
            )
            db.add(line_obj)
            contract_lines_count += 1
        db.commit()

    # 6. PDF-only contracts
    if os.path.exists(pdf_dir):
        pdf_files = glob.glob(os.path.join(pdf_dir, "*.pdf"))
        for p_file in pdf_files:
            c_id = os.path.basename(p_file).replace(".pdf", "")
            if c_id not in registered_ids:
                try:
                    c_data = extract_contract_from_pdf(p_file)
                    c_obj = db.query(Contract).filter_by(contract_id=c_id).first()
                    if not c_obj:
                        c_obj = Contract(contract_id=c_id)
                        db.add(c_obj)
                    c_obj.supplier_id = c_data["supplier_id"]
                    c_obj.supplier_name = c_data["supplier_name"]
                    c_obj.start_date = parse_date(c_data["start_date"])
                    c_obj.end_date = parse_date(c_data["end_date"])
                    c_obj.value_cap = float(c_data["value_cap"])
                    c_obj.consumed_value = 0.0  # As specified by policy
                    c_obj.source_type = "PDF"
                    c_obj.document_path = p_file
                    db.commit()

                    # Add lines
                    for l_data in c_data["lines"]:
                        existing_line = db.query(ContractLine).filter_by(
                            contract_id=c_id, item_code=l_data["item_code"]
                        ).first()
                        if not existing_line:
                            line_obj = ContractLine(
                                contract_id=c_id,
                                item_code=l_data["item_code"],
                                description=l_data["description"],
                                uom=l_data["uom"],
                                rate=l_data["rate"]
                            )
                            db.add(line_obj)
                            contract_lines_count += 1
                    db.commit()
                    contract_count += 1
                except Exception as e:
                    print(f"Error parsing PDF contract {p_file}: {e}")

    results["contracts"] = contract_count
    results["contract_lines"] = contract_lines_count

    # 7. Seed Policy v5.0 if not exists
    init_default_policy(db)
    results["policy"] = "v5.0 seeded"

    # 8. Sample PR batch
    pr_batch_csv = os.path.join(base_dir, "pr_batches", "sample_pr_batch.csv")
    if os.path.exists(pr_batch_csv):
        pr_count, line_count = import_pr_batch_csv(db, pr_batch_csv)
        results["purchase_requests"] = pr_count
        results["pr_lines"] = line_count

    return results

def init_default_policy(db: Session):
    pol = db.query(Policy).filter_by(version="5.0").first()
    if pol:
        return pol

    rules_config = {
        "version": "5.0",
        "document_id": "CORVO-PROC-POL-04",
        "title": "Corvo Engineering Pvt Ltd: Procurement Policy (PR to PO)",
        "effective_date": "2026-04-01",
        "clubbing_window_days": 14,
        "need_by_window_days": 7,
        "po_history_window_days": 365,
        "ranking_history_days": 548,
        "ranking_recency_days": 90,
        "consolidation_window_hours": 24,
        "rules": [
            {
                "priority": 1,
                "rule_number": "5.1",
                "rule_name": "Capex Sourcing",
                "clause_reference": "5.1",
                "condition_type": "item_type",
                "condition_params": {"item_type": "Capex"},
                "outcome_decision": "SOURCING_REQUEST",
                "outcome_route": "CAPEX_SOURCING",
                "suggested_suppliers_count": 5,
                "description": "Item type is Capex. Requires capex approval and 5 suggested suppliers."
            },
            {
                "priority": 2,
                "rule_number": "5.2",
                "rule_name": "Contract PO",
                "clause_reference": "5.2",
                "condition_type": "usable_contract",
                "condition_params": {},
                "outcome_decision": "PO",
                "outcome_route": "CONTRACT_PO",
                "description": "A rate contract covers the item, is valid on requirement date, supplier is Active, and ceiling has room."
            },
            {
                "priority": 3,
                "rule_number": "5.3",
                "rule_name": "Emergency PO",
                "clause_reference": "5.3",
                "condition_type": "emergency_limit",
                "condition_params": {
                    "max_value": 500000.0,
                    "require_emergency": True,
                    "require_active_po_within_days": 365
                },
                "outcome_decision": "PO",
                "outcome_route": "EMERGENCY_PO",
                "description": "Emergency requirement value <= ₹5,00,000 and bought from an Active supplier in the last 365 days."
            },
            {
                "priority": 4,
                "rule_number": "5.4",
                "rule_name": "Spot PO",
                "clause_reference": "5.4",
                "condition_type": "spot_limit",
                "condition_params": {
                    "max_value": 200000.0,
                    "require_active_po_within_days": 365
                },
                "outcome_decision": "PO",
                "outcome_route": "SPOT_PO",
                "description": "Requirement value < ₹2,00,000 and bought from an Active supplier in the last 365 days."
            },
            {
                "priority": 5,
                "rule_number": "5.5",
                "rule_name": "RFQ Sourcing",
                "clause_reference": "5.5",
                "condition_type": "value_below",
                "condition_params": {
                    "max_value": 1000000.0
                },
                "outcome_decision": "SOURCING_REQUEST",
                "outcome_route": "RFQ",
                "suggested_suppliers_count": 3,
                "description": "Requirement value < ₹10,00,000 (including small items not bought in 365 days)."
            },
            {
                "priority": 6,
                "rule_number": "5.6",
                "rule_name": "RFP Sourcing",
                "clause_reference": "5.6",
                "condition_type": "value_above_or_equal",
                "condition_params": {
                    "min_value": 1000000.0
                },
                "outcome_decision": "SOURCING_REQUEST",
                "outcome_route": "RFP",
                "suggested_suppliers_count": 5,
                "description": "Requirement value >= ₹10,00,000. Formal RFP with 5 suggested suppliers."
            }
        ]
    }

    pol = Policy(
        version="5.0",
        document_id="CORVO-PROC-POL-04",
        title="Corvo Engineering Pvt Ltd: Procurement Policy (PR to PO)",
        effective_date=date(2026, 4, 1),
        status="ACTIVE",
        rules_config=rules_config,
        change_summary="Base policy version 5.0",
        approved_at=datetime.utcnow(),
        approved_by="Head of Procurement"
    )
    db.add(pol)
    db.commit()
    db.refresh(pol)

    for r in rules_config["rules"]:
        p_rule = PolicyRule(
            policy_id=pol.id,
            rule_number=r["rule_number"],
            rule_name=r["rule_name"],
            priority=r["priority"],
            condition_type=r["condition_type"],
            condition_params=r["condition_params"],
            outcome_route=r["outcome_route"],
            outcome_decision=r["outcome_decision"],
            clause_reference=r["clause_reference"],
            description=r.get("description", ""),
            is_active=True
        )
        db.add(p_rule)
    db.commit()
    return pol

def import_pr_batch_csv(db: Session, csv_path: str):
    df = pd.read_csv(csv_path)
    pr_set = set()
    line_count = 0

    # Clean existing batch PRs if re-importing
    db.query(PRLine).delete()
    db.query(PurchaseRequest).delete()
    db.commit()

    for _, row in df.iterrows():
        pr_no = str(row["pr_no"]).strip()
        created_at = parse_datetime(row["created_at"])
        plant = str(row["plant"]).strip()

        if pr_no not in pr_set:
            pr_obj = PurchaseRequest(
                pr_no=pr_no,
                requester=str(row["requester"]).strip() if not pd.isna(row.get("requester")) else None,
                department=str(row["department"]).strip() if not pd.isna(row.get("department")) else None,
                plant=plant,
                created_at=created_at or datetime.utcnow(),
                status="SUBMITTED",
                source="BATCH"
            )
            db.add(pr_obj)
            pr_set.add(pr_no)

        item_code = str(row["item_code"]).strip() if not pd.isna(row.get("item_code")) and str(row.get("item_code")).strip() != "" else None
        desc = str(row["description"]).strip()
        uom = str(row["uom"]).strip() if not pd.isna(row.get("uom")) else None
        est_price = float(row["estimated_unit_price"]) if not pd.isna(row.get("estimated_unit_price")) and str(row.get("estimated_unit_price")).strip() != "" else None
        urgency = str(row["urgency"]).strip() if not pd.isna(row.get("urgency")) else "Normal"
        need_by = parse_date(row["need_by_date"])

        pr_line = PRLine(
            pr_no=pr_no,
            pr_line=int(row["pr_line"]),
            input_item_code=item_code,
            description=desc,
            quantity=float(row["quantity"]),
            uom=uom,
            estimated_unit_price=est_price,
            need_by_date=need_by,
            urgency=urgency,
            created_at=created_at or datetime.utcnow()
        )
        db.add(pr_line)
        line_count += 1

    db.commit()
    return len(pr_set), line_count
