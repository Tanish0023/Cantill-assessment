import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import PurchaseRequest, PRLine, Item, Plant, AuditLog
from app.services.ai_store import ai_store
from app.services.procurement_engine import resolve_item, process_batch

router = APIRouter()

class ChatMessageRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    current_state: Optional[Dict[str, Any]] = None

class ConfirmPRRequest(BaseModel):
    requester: Optional[str] = "Employee"
    department: Optional[str] = "Operations"
    plant: str
    item_code: Optional[str] = None
    description: Optional[str] = None
    item_description: Optional[str] = None
    quantity: float
    uom: Optional[str] = "NOS"
    need_by_date: str
    urgency: Optional[str] = "Normal"
    estimated_unit_price: Optional[float] = None

@router.post("/message")
def chat_message(req: ChatMessageRequest, db: Session = Depends(get_db)):
    extracted = ai_store.extract_pr_from_chat(req.message)

    # Merge with current state if any
    state = req.current_state or {}
    for key, val in extracted.items():
        if val is not None and key not in ("assistant_reply", "is_complete", "missing_fields"):
            state[key] = val

    desc = state.get("item_description")
    resolved_code = None
    matched_item = None

    if desc:
        code, item = resolve_item(db, state.get("item_code"), desc)
        resolved_code = code
        matched_item = item
        if code != "NEW" and item:
            state["resolved_item_code"] = code
            state["matched_description"] = item.description
            state["uom"] = state.get("uom") or item.uom
            state["standard_price"] = item.standard_price
        else:
            state["resolved_item_code"] = "NEW"

    # Identify missing fields
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

    # Generate assistant reply
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
        "response": reply,
        "is_complete": is_complete,
        "missing_fields": missing,
        "state": state,
        "extracted_pr": state
    }

@router.post("/confirm")
def confirm_pr(req: ConfirmPRRequest, db: Session = Depends(get_db)):
    today_str = datetime.date.today().strftime("%Y%m%d")
    pr_count = db.query(PurchaseRequest).filter(PurchaseRequest.pr_no.like(f"PR-CHAT-{today_str}-%")).count()
    pr_no = f"PR-CHAT-{today_str}-{pr_count+1:04d}"

    need_by = datetime.date.today()
    try:
        need_by = datetime.datetime.strptime(req.need_by_date, "%Y-%m-%d").date()
    except Exception:
        pass

    now = datetime.datetime.utcnow()

    # Create PurchaseRequest
    pr_obj = PurchaseRequest(
        pr_no=pr_no,
        requester=req.requester,
        department=req.department,
        plant=req.plant,
        created_at=now,
        status="SUBMITTED",
        source="CHAT"
    )
    db.add(pr_obj)

    # Create PRLine
    desc = req.description or req.item_description or "General Item"
    resolved_code, _ = resolve_item(db, req.item_code, desc)
    pr_line = PRLine(
        pr_no=pr_no,
        pr_line=1,
        input_item_code=req.item_code,
        resolved_item_code=resolved_code,
        description=desc,
        quantity=req.quantity,
        uom=req.uom,
        estimated_unit_price=req.estimated_unit_price,
        need_by_date=need_by,
        urgency=req.urgency,
        created_at=now
    )
    db.add(pr_line)

    # Audit log
    audit = AuditLog(
        entity_type="PURCHASE_REQUEST",
        entity_id=pr_no,
        action="CREATE_VIA_CHAT",
        performed_by=req.requester or "Employee",
        comment=f"Created PR {pr_no} via chat intake for {req.quantity} {req.uom} of {req.description}",
        payload_json=req.dict()
    )
    db.add(audit)
    db.commit()

    # Immediately evaluate with procurement engine
    single_line = [{
        "pr_no": pr_no,
        "pr_line": 1,
        "created_at": str(now),
        "plant": req.plant,
        "item_code": req.item_code,
        "description": req.description,
        "quantity": req.quantity,
        "uom": req.uom,
        "estimated_unit_price": req.estimated_unit_price,
        "need_by_date": str(need_by),
        "urgency": req.urgency
    }]
    decision_results = process_batch(db, single_line)
    decision = decision_results[0] if decision_results else {}

    return {
        "success": True,
        "pr_no": pr_no,
        "pr_line": 1,
        "decision": decision
    }

@router.get("/recent")
def get_recent_chat_prs(db: Session = Depends(get_db)):
    prs = db.query(PurchaseRequest).filter_by(source="CHAT").order_by(PurchaseRequest.created_at.desc()).limit(20).all()
    results = []
    for p in prs:
        lines = db.query(PRLine).filter_by(pr_no=p.pr_no).all()
        results.append({
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
    return results
