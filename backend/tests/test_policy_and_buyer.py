import pytest
from app.controllers.policy_controller import PolicyController
from app.controllers.buyer_controller import BuyerController
from app.controllers.procurement_controller import ProcurementController

def test_policy_amendment_and_versioning(db_session):
    policy_ctrl = PolicyController(db_session)
    active = policy_ctrl.get_active()
    assert active is not None
    assert "5.0" in active["version"]
    assert active["status"] == "ACTIVE"
    
    # Test drafting an amendment (simulating parsed amendment diff)
    parsed_amendment = {
        "new_version": "5.1",
        "document_id": "CORVO-PROC-POL-04-A1",
        "effective_date": "2026-11-20",
        "change_summary": "Raised Spot PO threshold to 300,000 INR",
        "plain_language_preview": "Spot PO limit is raised from 2L to 3L.",
        "updated_rules_config": {
            **active.get("rules_config", {}),
            "rule_5_3_max_value": 300000.0
        }
    }
    draft = policy_ctrl.create_amendment_draft(
        parsed_data=parsed_amendment,
        raw_text="Increase spot purchase limit to 300,000 INR per board resolution.",
        created_by="audit_tester"
    )
    
    assert draft["status"] == "PENDING_APPROVAL"
    assert draft["version"] == "5.1"
    
    # Approve and activate the draft policy
    activated = policy_ctrl.approve_policy(draft["policy_id"], approved_by="Head of Procurement")
    assert activated["success"] is True
    assert activated["status"] == "ACTIVE"
    assert activated["version"] == "5.1"
    
    # Verify active policy is now 5.1
    current_active = policy_ctrl.get_active()
    assert current_active["version"] == "5.1"

def test_buyer_approval_and_override_audit_logging(db_session):
    proc_ctrl = ProcurementController(db_session)
    # Run batch to populate requirements into DB
    proc_ctrl.process_batch(persist=True)
    
    buyer_ctrl = BuyerController(db_session)
    requirements = buyer_ctrl.get_workspace_requirements()
    assert len(requirements) > 0
    
    req_to_approve = requirements[0]
    req_id = req_to_approve["group_id"]
    
    # Approve
    approved = buyer_ctrl.approve_decision(req_id, buyer_name="Test Buyer")
    assert approved["success"] is True
    assert approved["status"] == "APPROVED"
    
    # Override on another requirement
    if len(requirements) > 1:
        req_to_override = requirements[1]
        override_id = req_to_override["group_id"]
        overridden = buyer_ctrl.override_decision(
            group_id=override_id,
            new_route="DIRECT_PURCHASE",
            reason="Special management exception for critical production line.",
            buyer_name="Senior Buyer"
        )
        assert overridden["success"] is True
        
        # Verify details and audit trail
        details = buyer_ctrl.get_requirement_details(override_id)
        assert details is not None
        assert details["decision"]["status"] == "OVERRIDDEN"
        assert "Special management exception" in details["decision"]["override_reason"]
        
        # Verify audit trail contains the action
        actions = [a["action"] for a in details["audit_trail"]]
        assert "OVERRIDE" in actions
