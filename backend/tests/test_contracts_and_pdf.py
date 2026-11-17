import os
import pytest
from app.controllers.contract_controller import ContractController
from app.services.contract_parser import extract_contract_from_pdf
from app.core.config import settings

def test_contract_ceiling_tracking(db_session):
    controller = ContractController(db_session)
    contracts = controller.get_all()
    
    assert len(contracts) >= 12  # 10 register + 2 PDF contracts
    for c in contracts:
        assert "contract_id" in c
        assert "value_cap" in c
        assert "consumed_value" in c
        assert "remaining_ceiling" in c
        assert c["remaining_ceiling"] == c["value_cap"] - c["consumed_value"]

def test_pdf_contract_extraction():
    doc_path = os.path.join(settings.DATA_DIR, "contracts", "pdf", "RC-2026-031.pdf")
    assert os.path.exists(doc_path), f"PDF file not found at {doc_path}"
    
    extracted = extract_contract_from_pdf(doc_path)
    assert extracted["contract_id"] == "RC-2026-031"
    assert extracted["supplier_id"] == "S021"
    assert extracted["supplier_name"] == "Pneumatic Point"
    assert extracted["value_cap"] == 2000000.0
    assert len(extracted["lines"]) >= 3
    
    line_codes = [l["item_code"] for l in extracted["lines"]]
    assert "ITM-1036" in line_codes
    assert "ITM-1037" in line_codes
    assert "ITM-1039" in line_codes
