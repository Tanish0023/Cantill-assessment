import os
import glob
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import PurchaseOrderHistory
from app.repositories import (
    PlantRepository, ItemRepository, SupplierRepository,
    POHistoryRepository, ContractRepository, PolicyRepository,
    PurchaseRequestRepository
)
from app.services.contract_parser import extract_contract_from_pdf
from app.services.data_import import parse_date, parse_datetime, init_default_policy

class DataController:
    def __init__(self, db: Session):
        self.db = db
        self.plants_repo = PlantRepository(db)
        self.items_repo = ItemRepository(db)
        self.suppliers_repo = SupplierRepository(db)
        self.po_repo = POHistoryRepository(db)
        self.contract_repo = ContractRepository(db)
        self.policy_repo = PolicyRepository(db)
        self.pr_repo = PurchaseRequestRepository(db)

    def get_stats(self) -> dict:
        active_pol = self.policy_repo.get_active_policy()
        return {
            "plants": self.plants_repo.count(),
            "items": self.items_repo.count(),
            "suppliers": self.suppliers_repo.count(),
            "contracts": self.contract_repo.count(),
            "contract_lines": self.contract_repo.count_lines(),
            "po_history": self.po_repo.count(),
            "policies": self.policy_repo.count(),
            "purchase_requests": self.pr_repo.count(),
            "pr_lines": self.pr_repo.count_lines(),
            "active_policy_version": active_pol.version if active_pol else "5.0",
            "active_policy_title": active_pol.title if active_pol else "Corvo Engineering Procurement Policy",
        }

    def import_all(self, base_dir: str = None) -> dict:
        if base_dir is None:
            base_dir = settings.DATA_DIR

        # Check if CSV directory exists, otherwise fallback to bundled seed_data.json
        plants_csv = os.path.join(base_dir, "master_data", "plants.csv")
        seed_json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "core", "seed_data.json")

        if not os.path.exists(plants_csv) and os.path.exists(seed_json_path):
            return self.import_from_json(seed_json_path)

        results = {}

        # 1. Plants
        if os.path.exists(plants_csv):
            df_plants = pd.read_csv(plants_csv)
            for _, r in df_plants.iterrows():
                self.plants_repo.upsert(str(r["plant"]).strip(), str(r["name"]).strip())
            results["plants"] = len(df_plants)

        # 2. Suppliers
        suppliers_csv = os.path.join(base_dir, "master_data", "supplier_master.csv")
        if os.path.exists(suppliers_csv):
            df_supp = pd.read_csv(suppliers_csv)
            for _, r in df_supp.iterrows():
                self.suppliers_repo.upsert(
                    supplier_id=str(r["supplier_id"]).strip(),
                    name=str(r["name"]).strip(),
                    city=str(r["city"]).strip(),
                    categories=str(r["categories"]).strip(),
                    status=str(r["status"]).strip(),
                    on_time_pct=float(r["on_time_pct"]),
                    quality_rating=float(r["quality_rating"])
                )
            results["suppliers"] = len(df_supp)

        # 3. Items
        items_csv = os.path.join(base_dir, "master_data", "item_master.csv")
        if os.path.exists(items_csv):
            df_items = pd.read_csv(items_csv)
            for _, r in df_items.iterrows():
                self.items_repo.upsert(
                    item_code=str(r["item_code"]).strip(),
                    description=str(r["description"]).strip(),
                    uom=str(r["uom"]).strip(),
                    category=str(r["category"]).strip(),
                    item_type=str(r["item_type"]).strip(),
                    standard_price=float(r["standard_price"])
                )
            results["items"] = len(df_items)

        # 4. PO History
        po_csv = os.path.join(base_dir, "master_data", "po_history.csv")
        if os.path.exists(po_csv):
            df_po = pd.read_csv(po_csv)
            self.po_repo.clear_all()
            for _, r in df_po.iterrows():
                po_date = parse_date(r["po_date"])
                delivered = True
                if "delivered_on_time" in r and not pd.isna(r["delivered_on_time"]):
                    delivered = str(r["delivered_on_time"]).lower() in ("true", "1", "yes")
                po_obj = PurchaseOrderHistory(
                    po_number=str(r["po_number"]).strip(),
                    po_date=po_date,
                    supplier_id=str(r["supplier_id"]).strip(),
                    item_code=str(r["item_code"]).strip(),
                    quantity=float(r["quantity"]),
                    uom=str(r["uom"]).strip(),
                    unit_price=float(r["unit_price"]),
                    plant=str(r["plant"]).strip(),
                    delivered_on_time=delivered
                )
                self.po_repo.add(po_obj)
            self.po_repo.commit()
            results["po_history"] = len(df_po)

        # 5. Contracts & Lines
        reg_csv = os.path.join(base_dir, "contracts", "contract_register.csv")
        lines_csv = os.path.join(base_dir, "contracts", "contract_lines.csv")
        pdf_dir = os.path.join(base_dir, "contracts", "pdf")
        registered_ids = set()

        if os.path.exists(reg_csv):
            df_reg = pd.read_csv(reg_csv)
            for _, r in df_reg.iterrows():
                c_id = str(r["contract_id"]).strip()
                registered_ids.add(c_id)
                pdf_path = os.path.join(pdf_dir, f"{c_id}.pdf")
                doc_path = pdf_path if os.path.exists(pdf_path) else None
                consumed = float(r["consumed_value"]) if not pd.isna(r.get("consumed_value")) else 0.0
                self.contract_repo.upsert_contract(
                    contract_id=c_id,
                    supplier_id=str(r["supplier_id"]).strip(),
                    supplier_name=str(r["supplier_name"]).strip(),
                    start_date=parse_date(r["start_date"]),
                    end_date=parse_date(r["end_date"]),
                    value_cap=float(r["value_cap"]),
                    consumed_value=consumed,
                    source_type="REGISTER",
                    document_path=doc_path
                )

        if os.path.exists(lines_csv):
            df_lines = pd.read_csv(lines_csv)
            self.contract_repo.clear_lines()
            for _, r in df_lines.iterrows():
                self.contract_repo.add_line(
                    contract_id=str(r["contract_id"]).strip(),
                    item_code=str(r["item_code"]).strip(),
                    description=str(r["description"]).strip(),
                    uom=str(r["uom"]).strip(),
                    rate=float(r["rate"])
                )

        # PDF-only contracts
        if os.path.exists(pdf_dir):
            for p_file in glob.glob(os.path.join(pdf_dir, "*.pdf")):
                c_id = os.path.basename(p_file).replace(".pdf", "")
                if c_id not in registered_ids:
                    try:
                        c_data = extract_contract_from_pdf(p_file)
                        self.contract_repo.upsert_contract(
                            contract_id=c_id,
                            supplier_id=c_data["supplier_id"],
                            supplier_name=c_data["supplier_name"],
                            start_date=parse_date(c_data["start_date"]),
                            end_date=parse_date(c_data["end_date"]),
                            value_cap=float(c_data["value_cap"]),
                            consumed_value=0.0,
                            source_type="PDF",
                            document_path=p_file
                        )
                        for l in c_data["lines"]:
                            self.contract_repo.add_line(
                                contract_id=c_id,
                                item_code=l["item_code"],
                                description=l["description"],
                                uom=l["uom"],
                                rate=l["rate"]
                            )
                    except Exception as e:
                        print(f"Error parsing PDF contract {p_file}: {e}")

        results["contracts"] = self.contract_repo.count()
        results["contract_lines"] = self.contract_repo.count_lines()

        # Seed default policy if needed
        init_default_policy(self.db)
        results["policy"] = "v5.0 seeded"

        # Import sample PR batch
        sample_batch_csv = os.path.join(base_dir, "pr_batches", "sample_pr_batch.csv")
        if os.path.exists(sample_batch_csv):
            df_batch = pd.read_csv(sample_batch_csv)
            self.pr_repo.clear_all()
            pr_set = set()
            for _, r in df_batch.iterrows():
                pr_no = str(r["pr_no"]).strip()
                if pr_no not in pr_set:
                    self.pr_repo.create_pr(
                        pr_no=pr_no,
                        plant=str(r["plant"]).strip(),
                        requester=str(r["requester"]).strip() if not pd.isna(r.get("requester")) else None,
                        department=str(r["department"]).strip() if not pd.isna(r.get("department")) else None,
                        created_at=parse_datetime(r["created_at"]),
                        status="SUBMITTED",
                        source="BATCH"
                    )
                    pr_set.add(pr_no)
                
                item_code = str(r["item_code"]).strip() if not pd.isna(r.get("item_code")) and str(r.get("item_code")).strip() != "" else None
                est_p = float(r["estimated_unit_price"]) if not pd.isna(r.get("estimated_unit_price")) and str(r.get("estimated_unit_price")).strip() != "" else None
                self.pr_repo.create_pr_line(
                    pr_no=pr_no,
                    pr_line=int(r["pr_line"]),
                    description=str(r["description"]).strip(),
                    quantity=float(r["quantity"]),
                    need_by_date=parse_date(r["need_by_date"]),
                    input_item_code=item_code,
                    uom=str(r["uom"]).strip() if not pd.isna(r.get("uom")) else "NOS",
                    estimated_unit_price=est_p,
                    urgency=str(r["urgency"]).strip() if not pd.isna(r.get("urgency")) else "Normal",
                    created_at=parse_datetime(r["created_at"])
                )
            results["purchase_requests"] = len(pr_set)
            results["pr_lines"] = len(df_batch)

        return results

    def import_from_json(self, json_path: str) -> dict:
        import json
        with open(json_path, "r") as f:
            data = json.load(f)

        results = {}

        # 1. Plants
        plants = data.get("plants", [])
        for r in plants:
            self.plants_repo.upsert(str(r["plant"]).strip(), str(r["name"]).strip())
        results["plants"] = len(plants)

        # 2. Suppliers
        suppliers = data.get("suppliers", [])
        for r in suppliers:
            self.suppliers_repo.upsert(
                supplier_id=str(r["supplier_id"]).strip(),
                name=str(r["name"]).strip(),
                city=str(r["city"]).strip(),
                categories=str(r["categories"]).strip(),
                status=str(r["status"]).strip(),
                on_time_pct=float(r["on_time_pct"]),
                quality_rating=float(r["quality_rating"])
            )
        results["suppliers"] = len(suppliers)

        # 3. Items
        items = data.get("items", [])
        for r in items:
            self.items_repo.upsert(
                item_code=str(r["item_code"]).strip(),
                description=str(r["description"]).strip(),
                uom=str(r["uom"]).strip(),
                category=str(r["category"]).strip(),
                item_type=str(r["item_type"]).strip(),
                standard_price=float(r["standard_price"])
            )
        results["items"] = len(items)

        # 4. PO History
        po_history = data.get("po_history", [])
        self.po_repo.clear_all()
        for r in po_history:
            po_date = parse_date(r["po_date"])
            delivered = True
            if "delivered_on_time" in r and r.get("delivered_on_time") is not None:
                delivered = str(r["delivered_on_time"]).lower() in ("true", "1", "yes")
            po_obj = PurchaseOrderHistory(
                po_number=str(r["po_number"]).strip(),
                po_date=po_date,
                supplier_id=str(r["supplier_id"]).strip(),
                item_code=str(r["item_code"]).strip(),
                quantity=float(r["quantity"]),
                uom=str(r["uom"]).strip(),
                unit_price=float(r["unit_price"]),
                plant=str(r["plant"]).strip(),
                delivered_on_time=delivered
            )
            self.po_repo.add(po_obj)
        self.po_repo.commit()
        results["po_history"] = len(po_history)

        # 5. Contracts & Lines
        contracts = data.get("contracts", [])
        for r in contracts:
            c_id = str(r["contract_id"]).strip()
            consumed = float(r["consumed_value"]) if r.get("consumed_value") is not None and not pd.isna(r["consumed_value"]) else 0.0
            self.contract_repo.upsert_contract(
                contract_id=c_id,
                supplier_id=str(r["supplier_id"]).strip(),
                supplier_name=str(r["supplier_name"]).strip(),
                start_date=parse_date(r["start_date"]),
                end_date=parse_date(r["end_date"]),
                value_cap=float(r["value_cap"]),
                consumed_value=consumed,
                source_type="REGISTER",
                document_path=None
            )

        contract_lines = data.get("contract_lines", [])
        self.contract_repo.clear_lines()
        for r in contract_lines:
            self.contract_repo.add_line(
                contract_id=str(r["contract_id"]).strip(),
                item_code=str(r["item_code"]).strip(),
                description=str(r["description"]).strip(),
                uom=str(r["uom"]).strip(),
                rate=float(r["rate"])
            )

        # PDF contracts
        pdf_contracts = data.get("pdf_contracts", [])
        for c_data in pdf_contracts:
            c_id = c_data["contract_id"]
            self.contract_repo.upsert_contract(
                contract_id=c_id,
                supplier_id=c_data["supplier_id"],
                supplier_name=c_data["supplier_name"],
                start_date=parse_date(c_data["start_date"]),
                end_date=parse_date(c_data["end_date"]),
                value_cap=float(c_data["value_cap"]),
                consumed_value=0.0,
                source_type="PDF",
                document_path=None
            )
            for l in c_data["lines"]:
                self.contract_repo.add_line(
                    contract_id=c_id,
                    item_code=l["item_code"],
                    description=l["description"],
                    uom=l["uom"],
                    rate=l["rate"]
                )

        results["contracts"] = self.contract_repo.count()
        results["contract_lines"] = self.contract_repo.count_lines()

        # Seed policy
        init_default_policy(self.db)
        results["policy"] = "v5.0 seeded"

        # PR Batch
        pr_batch = data.get("pr_batch", [])
        self.pr_repo.clear_all()
        pr_set = set()
        for r in pr_batch:
            pr_no = str(r["pr_no"]).strip()
            if pr_no not in pr_set:
                self.pr_repo.create_pr(
                    pr_no=pr_no,
                    plant=str(r["plant"]).strip(),
                    requester=str(r["requester"]).strip() if r.get("requester") is not None and not pd.isna(r["requester"]) else None,
                    department=str(r["department"]).strip() if r.get("department") is not None and not pd.isna(r["department"]) else None,
                    created_at=parse_datetime(r["created_at"]),
                    status="SUBMITTED",
                    source="BATCH"
                )
                pr_set.add(pr_no)

            item_code = str(r["item_code"]).strip() if r.get("item_code") is not None and not pd.isna(r["item_code"]) and str(r["item_code"]).strip() != "" else None
            est_p = float(r["estimated_unit_price"]) if r.get("estimated_unit_price") is not None and not pd.isna(r["estimated_unit_price"]) and str(r["estimated_unit_price"]).strip() != "" else None
            self.pr_repo.create_pr_line(
                pr_no=pr_no,
                pr_line=int(r["pr_line"]),
                description=str(r["description"]).strip(),
                quantity=float(r["quantity"]),
                need_by_date=parse_date(r["need_by_date"]),
                input_item_code=item_code,
                uom=str(r["uom"]).strip() if r.get("uom") is not None and not pd.isna(r["uom"]) else "NOS",
                estimated_unit_price=est_p,
                urgency=str(r["urgency"]).strip() if r.get("urgency") is not None and not pd.isna(r["urgency"]) else "Normal",
                created_at=parse_datetime(r["created_at"])
            )
        results["purchase_requests"] = len(pr_set)
        results["pr_lines"] = len(pr_batch)

        # Pre-evaluate batch to populate Buyer Workspace requirements
        try:
            from app.controllers.procurement_controller import ProcurementController
            proc_ctrl = ProcurementController(self.db)
            proc_ctrl.process_batch(lines_data=pr_batch, persist=True)
            results["evaluated_requirements"] = True
        except Exception as e:
            print(f"Error evaluating batch during seed: {e}")

        return results
