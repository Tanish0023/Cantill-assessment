import os
import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.repositories import ContractRepository, AuditLogRepository
from app.services.contract_parser import extract_contract_from_pdf

class ContractController:
    def __init__(self, db: Session):
        self.db = db
        self.contract_repo = ContractRepository(db)
        self.audit_repo = AuditLogRepository(db)

    def get_all(self) -> List[Dict[str, Any]]:
        contracts = self.contract_repo.get_all()
        res = []
        for c in contracts:
            lines = [{
                "id": l.id,
                "item_code": l.item_code,
                "description": l.description,
                "uom": l.uom,
                "rate": l.rate
            } for l in c.lines]
            res.append({
                "contract_id": c.contract_id,
                "supplier_id": c.supplier_id,
                "supplier_name": c.supplier_name,
                "start_date": str(c.start_date),
                "end_date": str(c.end_date),
                "value_cap": c.value_cap,
                "consumed_value": c.consumed_value,
                "remaining_ceiling": c.value_cap - c.consumed_value,
                "source_type": c.source_type,
                "document_path": c.document_path,
                "lines": lines
            })
        return res

    def extract_and_create_from_pdf(self, pdf_path: str, added_by: str = "Buyer") -> Dict[str, Any]:
        data = extract_contract_from_pdf(pdf_path)
        c_id = data["contract_id"]
        
        start_d = datetime.datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        end_d = datetime.datetime.strptime(data["end_date"], "%Y-%m-%d").date()

        c = self.contract_repo.upsert_contract(
            contract_id=c_id,
            supplier_id=data["supplier_id"],
            supplier_name=data["supplier_name"],
            start_date=start_d,
            end_date=end_d,
            value_cap=data["value_cap"],
            consumed_value=0.0,
            source_type="PDF",
            document_path=pdf_path
        )

        for l in data["lines"]:
            self.contract_repo.add_line(
                contract_id=c_id,
                item_code=l["item_code"],
                description=l["description"],
                uom=l["uom"],
                rate=l["rate"]
            )

        self.audit_repo.log(
            entity_type="CONTRACT",
            entity_id=c_id,
            action="ADD_PDF_CONTRACT",
            performed_by=added_by,
            comment=f"Added contract {c_id} from PDF for {data['supplier_name']} with cap INR {data['value_cap']:,.2f}",
            payload_json=data
        )

        return {
            "success": True,
            "contract_id": c_id,
            "supplier_id": data["supplier_id"],
            "supplier_name": data["supplier_name"],
            "value_cap": data["value_cap"],
            "lines_count": len(data["lines"])
        }

    def create_contract_manual(self, contract_data: Dict[str, Any], added_by: str = "Buyer") -> Dict[str, Any]:
        c_id = contract_data["contract_id"].strip()
        start_d = datetime.datetime.strptime(contract_data["start_date"], "%Y-%m-%d").date()
        end_d = datetime.datetime.strptime(contract_data["end_date"], "%Y-%m-%d").date()

        self.contract_repo.upsert_contract(
            contract_id=c_id,
            supplier_id=contract_data["supplier_id"].strip(),
            supplier_name=contract_data["supplier_name"].strip(),
            start_date=start_d,
            end_date=end_d,
            value_cap=float(contract_data["value_cap"]),
            consumed_value=float(contract_data.get("consumed_value", 0.0)),
            source_type=contract_data.get("source_type", "MANUAL")
        )

        for l in contract_data.get("lines", []):
            self.contract_repo.add_line(
                contract_id=c_id,
                item_code=l["item_code"].strip(),
                description=l["description"].strip(),
                uom=l.get("uom", "NOS"),
                rate=float(l["rate"])
            )

        self.audit_repo.log(
            entity_type="CONTRACT",
            entity_id=c_id,
            action="CREATE_MANUAL_CONTRACT",
            performed_by=added_by,
            comment=f"Manually created contract {c_id} for {contract_data['supplier_name']}",
            payload_json=contract_data
        )

        return {"success": True, "contract_id": c_id}
