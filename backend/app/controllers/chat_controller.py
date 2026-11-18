import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.repositories import ItemRepository, PurchaseRequestRepository, AuditLogRepository
from app.services.ai_store import ai_store
from app.controllers.procurement_controller import ProcurementController

class ChatController:
    def __init__(self, db: Session):
        self.db = db
        self.item_repo = ItemRepository(db)
        self.pr_repo = PurchaseRequestRepository(db)
        self.audit_repo = AuditLogRepository(db)
        self.procurement_controller = ProcurementController(db)

    def process_message(self, message: str, current_state: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        extracted = ai_store.extract_pr_from_chat(message)
        state = current_state or {}

        for key, val in extracted.items():
            if val is not None and key not in ("assistant_reply", "is_complete", "missing_fields"):
                state[key] = val

        desc = state.get("item_description")
        if desc:
            code, item = self.procurement_controller.resolve_item(state.get("item_code"), desc)
            if code != "NEW" and item:
                state["resolved_item_code"] = code
                state["matched_description"] = item.description
                state["uom"] = state.get("uom") or item.uom
                state["standard_price"] = item.standard_price
            else:
                state["resolved_item_code"] = "NEW"

        missing = []
        if not state.get("item_description"):
            missing.append("item description")
        if not state.get("quantity") or float(state.get("quantity", 0)) <= 0:
            missing.append("quantity")
        if not state.get("plant") or state.get("plant") not in ("PUN1", "CHK1"):
            missing.append("plant (PUN1 Bhosari or CHK1 Chakan)")
        if not state.get("need_by_date"):
            missing.append("need-by date")
        if state.get("resolved_item_code") == "NEW" and not state.get("estimated_unit_price"):
            missing.append("estimated unit price (required for new/unlisted items)")

        is_complete = (len(missing) == 0)

        if is_complete:
            item_text = f"{state['matched_description']} (code: {state['resolved_item_code']})" if state.get('resolved_item_code') != "NEW" else f"'{state['item_description']}' (New unlisted item)"
            reply = (
                f"I have all details ready for your purchase request:\n\n"
                f"• **Item**: {item_text}\n"
                f"• **Quantity**: {state['quantity']} {state.get('uom', 'NOS')}\n"
                f"• **Plant**: {state['plant']}\n"
                f"• **Need-by Date**: {state['need_by_date']}\n"
                f"• **Urgency**: {state.get('urgency', 'Normal')}\n"
            )
            if state.get("resolved_item_code") == "NEW":
                reply += f"• **Estimated Unit Price**: ₹{state['estimated_unit_price']:,.2f}\n"
            reply += "\nPlease confirm to submit this request."
        else:
            if len(missing) == 1:
                reply = f"Could you please specify the {missing[0]}?"
            else:
                reply = f"I noted your request. To proceed, please provide: {', '.join(missing)}."

        return {
            "reply": reply,
            "is_complete": is_complete,
            "missing_fields": missing,
            "state": state
        }

    def confirm_pr(self, req_data: Dict[str, Any]) -> Dict[str, Any]:
        today_str = datetime.date.today().strftime("%Y%m%d")
        pr_count = self.pr_repo.count()
        pr_no = f"PR-CHAT-{today_str}-{pr_count+1:04d}"

        need_by = datetime.date.today()
        try:
            need_by = datetime.datetime.strptime(req_data["need_by_date"], "%Y-%m-%d").date()
        except Exception:
            pass

        now = datetime.datetime.utcnow()

        self.pr_repo.create_pr(
            pr_no=pr_no,
            plant=req_data["plant"],
            requester=req_data.get("requester", "Employee"),
            department=req_data.get("department", "Operations"),
            created_at=now,
            status="SUBMITTED",
            source="CHAT"
        )

        desc = req_data.get("description") or req_data.get("item_description") or "General Item"
        resolved_code, _ = self.procurement_controller.resolve_item(req_data.get("item_code"), desc)
        self.pr_repo.create_pr_line(
            pr_no=pr_no,
            pr_line=1,
            description=desc,
            quantity=req_data["quantity"],
            need_by_date=need_by,
            input_item_code=req_data.get("item_code"),
            resolved_item_code=resolved_code,
            uom=req_data.get("uom", "NOS"),
            estimated_unit_price=req_data.get("estimated_unit_price"),
            urgency=req_data.get("urgency", "Normal"),
            created_at=now
        )

        self.audit_repo.log(
            entity_type="PURCHASE_REQUEST",
            entity_id=pr_no,
            action="CREATE_VIA_CHAT",
            performed_by=req_data.get("requester", "Employee"),
            comment=f"Created PR {pr_no} via chat intake for {req_data['quantity']} of {req_data['description']}",
            payload_json=req_data
        )

        # Immediate decision
        line = [{
            "pr_no": pr_no,
            "pr_line": 1,
            "created_at": str(now),
            "plant": req_data["plant"],
            "item_code": req_data.get("item_code"),
            "description": req_data["description"],
            "quantity": req_data["quantity"],
            "uom": req_data.get("uom", "NOS"),
            "estimated_unit_price": req_data.get("estimated_unit_price"),
            "need_by_date": str(need_by),
            "urgency": req_data.get("urgency", "Normal")
        }]
        decision_results = self.procurement_controller.process_batch(line, persist=True)
        decision = decision_results[0] if decision_results else {}

        return {
            "success": True,
            "pr_no": pr_no,
            "pr_line": 1,
            "decision": decision
        }

    def get_recent(self) -> List[Dict[str, Any]]:
        prs = self.pr_repo.get_recent_chat_prs(limit=20)
        res = []
        for p in prs:
            lines = self.pr_repo.get_lines_for_pr(p.pr_no)
            res.append({
                "pr_no": p.pr_no,
                "requester": p.requester,
                "department": p.department,
                "plant": p.plant,
                "created_at": str(p.created_at),
                "status": p.status,
                "lines": [{
                    "pr_line": l.pr_line,
                    "description": l.description,
                    "resolved_item_code": l.resolved_item_code,
                    "quantity": l.quantity,
                    "uom": l.uom,
                    "need_by_date": str(l.need_by_date),
                    "urgency": l.urgency
                } for l in lines]
            })
        return res
