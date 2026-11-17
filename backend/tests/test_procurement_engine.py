import pytest
from app.controllers.procurement_controller import ProcurementController

def test_14_worked_examples_validation(db_session):
    controller = ProcurementController(db_session)
    results = controller.process_batch(persist=False)
    assert len(results) == 186
    by_pr = {r["pr_no"]: r for r in results}

    # Example 1: Contract PO with room under ceiling
    ex1 = by_pr["PR-26-00019"]
    assert ex1["decision"] == "PO"
    assert ex1["route"] == "CONTRACT_PO"
    assert ex1["supplier_id"] == "S001"
    assert abs(ex1["group_value_inr"] - 137531.25) < 1.0

    # Example 2: Contract only in PDF (RC-2026-031)
    ex2 = by_pr["PR-26-00045"]
    assert ex2["decision"] == "PO"
    assert ex2["route"] == "CONTRACT_PO"
    assert ex2["supplier_id"] == "S021"
    assert abs(ex2["group_value_inr"] - 26829.11) < 1.0

    # Example 3: Ceiling nearly used up -> lowest contract rate used -> RFQ
    ex3_a = by_pr["PR-26-00004"]
    ex3_b = by_pr["PR-26-00026"]
    assert ex3_a["group_id"] == ex3_b["group_id"]
    assert ex3_a["decision"] == "SOURCING_REQUEST"
    assert ex3_a["route"] == "RFQ"
    assert abs(ex3_a["group_value_inr"] - 220255.6) < 1.0

    # Example 4: Two contracts covering same item -> select cheaper with headroom (S007)
    ex4 = by_pr["PR-26-00034"]
    assert ex4["decision"] == "PO"
    assert ex4["route"] == "CONTRACT_PO"
    assert ex4["supplier_id"] == "S007"

    # Example 5: Split PRs clubbed into one requirement group
    ex5_a = by_pr["PR-26-00146"]
    ex5_b = by_pr["PR-26-00144"]
    ex5_c = by_pr["PR-26-00145"]
    assert ex5_a["group_id"] == ex5_b["group_id"] == ex5_c["group_id"]
    assert ex5_a["decision"] == "PO"
    assert ex5_a["route"] == "SPOT_PO"
    assert ex5_a["supplier_id"] == "S024"
    assert abs(ex5_a["group_value_inr"] - 126472.0) < 1.0

    # Example 6: Same item different plants -> NOT clubbed
    ex6_a = by_pr["PR-26-00106"]  # PUN1
    ex6_b = by_pr["PR-26-00103"]  # CHK1
    assert ex6_a["group_id"] != ex6_b["group_id"]
    assert ex6_a["route"] == "SPOT_PO"
    assert ex6_b["route"] == "SPOT_PO"

    # Example 7: Free-text item matched
    ex7 = by_pr["PR-26-00088"]
    assert ex7["resolved_item_code"] == "ITM-1035"
    assert ex7["decision"] == "PO"
    assert ex7["route"] == "SPOT_PO"
    assert ex7["supplier_id"] == "S023"

    # Example 8: Emergency PO between 2L and 5L
    ex8 = by_pr["PR-26-00059"]
    assert ex8["decision"] == "PO"
    assert ex8["route"] == "EMERGENCY_PO"
    assert ex8["supplier_id"] == "S014"
    assert abs(ex8["group_value_inr"] - 253184.2) < 1.0

    # Example 9: RFQ above PO limit (2L to 10L)
    ex9 = by_pr["PR-26-00089"]
    assert ex9["decision"] == "SOURCING_REQUEST"
    assert ex9["route"] == "RFQ"
    assert len(ex9["suggested_supplier_ids"]) > 0

    # Example 10: RFQ small value but never bought in 365 days
    ex10 = by_pr["PR-26-00050"]
    assert ex10["decision"] == "SOURCING_REQUEST"
    assert ex10["route"] == "RFQ"

    # Example 11: RFP above 10L
    ex11 = by_pr["PR-26-00100"]
    assert ex11["decision"] == "SOURCING_REQUEST"
    assert ex11["route"] == "RFP"
    assert len(ex11["suggested_supplier_ids"].split(";")) >= 3

    # Example 12: Capex items
    ex12 = by_pr["PR-26-00047"]
    assert ex12["decision"] == "SOURCING_REQUEST"
    assert ex12["route"] == "CAPEX_SOURCING"

    # Example 13: New item description
    ex13 = by_pr["PR-26-00170"]
    assert ex13["resolved_item_code"] == "NEW"
    assert ex13["decision"] == "SOURCING_REQUEST"
    assert ex13["route"] == "NEW_ITEM_SOURCING"
    assert ex13["suggested_supplier_ids"] == ""

    # Example 14: Several requirements consolidated onto one PO
    assert by_pr["PR-26-00034"]["po_id"] != ""
    assert by_pr["PR-26-00034"]["po_id"] == by_pr["PR-26-00031"]["po_id"]

def test_batch_processing_schema_and_columns(db_session):
    controller = ProcurementController(db_session)
    results = controller.process_batch(persist=False)
    
    assert len(results) == 186
    expected_cols = [
        "pr_no", "pr_line", "resolved_item_code", "group_id", "po_id",
        "decision", "route", "supplier_id", "unit_price", "group_value_inr",
        "suggested_supplier_ids", "policy_version", "reason"
    ]
    for r in results:
        for col in expected_cols:
            assert col in r, f"Missing required column {col} in row {r.get('pr_no')}"
