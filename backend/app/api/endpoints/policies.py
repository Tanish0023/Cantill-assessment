from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.controllers.policy_controller import PolicyController
import pymupdf

router = APIRouter()

class PreviewAmendmentRequest(BaseModel):
    amendment_text: str

class CreateDraftRequest(BaseModel):
    parsed_data: Dict[str, Any]
    raw_text: str
    created_by: Optional[str] = "Buyer"

class ActionPolicyRequest(BaseModel):
    actor: Optional[str] = "Head of Procurement"
    reason: Optional[str] = ""

@router.get("")
def list_policies(db: Session = Depends(get_db)):
    controller = PolicyController(db)
    return controller.get_all()

@router.get("/active")
def get_active_policy(as_of_date: Optional[str] = None, db: Session = Depends(get_db)):
    import datetime
    target_date = None
    if as_of_date:
        try:
            target_date = datetime.datetime.strptime(as_of_date, "%Y-%m-%d").date()
        except ValueError:
            pass
    controller = PolicyController(db)
    pol = controller.get_active(target_date)
    if not pol:
        raise HTTPException(status_code=404, detail="No active policy found")
    return pol

@router.post("/preview")
def preview_amendment(req: PreviewAmendmentRequest, db: Session = Depends(get_db)):
    controller = PolicyController(db)
    return controller.preview_amendment(req.amendment_text)

@router.post("/preview-pdf")
async def preview_amendment_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        doc = pymupdf.open(stream=content, filetype="pdf")
        text = "\n".join([page.get_text() for page in doc])
        controller = PolicyController(db)
        return controller.preview_amendment(text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process amendment PDF: {e}")

@router.post("/draft")
def create_draft(req: CreateDraftRequest, db: Session = Depends(get_db)):
    controller = PolicyController(db)
    return controller.create_amendment_draft(req.parsed_data, req.raw_text, req.created_by or "Buyer")

@router.post("/{policy_id}/approve")
def approve_policy(policy_id: int, req: ActionPolicyRequest, db: Session = Depends(get_db)):
    controller = PolicyController(db)
    res = controller.approve_policy(policy_id, approved_by=req.actor or "Head of Procurement")
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to approve policy"))
    return res

@router.post("/{policy_id}/reject")
def reject_policy(policy_id: int, req: ActionPolicyRequest, db: Session = Depends(get_db)):
    controller = PolicyController(db)
    res = controller.reject_policy(policy_id, rejected_by=req.actor or "Head of Procurement", reason=req.reason or "")
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to reject policy"))
    return res
