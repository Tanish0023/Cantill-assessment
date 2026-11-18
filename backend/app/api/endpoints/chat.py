import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.controllers.chat_controller import ChatController

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
    controller = ChatController(db)
    res = controller.process_message(req.message, req.current_state)
    return {
        "reply": res["reply"],
        "response": res["reply"],
        "is_complete": res["is_complete"],
        "missing_fields": res["missing_fields"],
        "state": res["state"],
        "extracted_pr": res["state"]
    }

@router.post("/confirm")
def confirm_pr(req: ConfirmPRRequest, db: Session = Depends(get_db)):
    controller = ChatController(db)
    payload = req.model_dump() if hasattr(req, "model_dump") else req.dict()
    res = controller.confirm_pr(payload)
    return res

@router.get("/recent")
def get_recent_chat_prs(db: Session = Depends(get_db)):
    controller = ChatController(db)
    return controller.get_recent()
