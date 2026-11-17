from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.controllers.buyer_controller import BuyerController

router = APIRouter()

class ApproveRequest(BaseModel):
    buyer_name: Optional[str] = "Buyer"

class OverrideRequest(BaseModel):
    new_route: str
    reason: str
    new_supplier_id: Optional[str] = None
    buyer_name: Optional[str] = "Buyer"

@router.get("/requirements")
def list_requirements(db: Session = Depends(get_db)):
    controller = BuyerController(db)
    return controller.get_workspace_requirements()

@router.get("/requirements/{group_id}")
def get_requirement_details(group_id: str, db: Session = Depends(get_db)):
    controller = BuyerController(db)
    res = controller.get_requirement_details(group_id)
    if not res:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return res

@router.post("/requirements/{group_id}/approve")
def approve_decision(group_id: str, req: ApproveRequest, db: Session = Depends(get_db)):
    controller = BuyerController(db)
    res = controller.approve_decision(group_id, buyer_name=req.buyer_name or "Buyer")
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error"))
    return res

@router.post("/requirements/{group_id}/override")
def override_decision(group_id: str, req: OverrideRequest, db: Session = Depends(get_db)):
    controller = BuyerController(db)
    res = controller.override_decision(
        group_id=group_id,
        new_route=req.new_route,
        reason=req.reason,
        new_supplier_id=req.new_supplier_id,
        buyer_name=req.buyer_name or "Buyer"
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error"))
    return res

@router.get("/audit-logs")
def get_audit_logs(limit: int = 100, db: Session = Depends(get_db)):
    controller = BuyerController(db)
    return controller.get_audit_logs(limit=limit)
