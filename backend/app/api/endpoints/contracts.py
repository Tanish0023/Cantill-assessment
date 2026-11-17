import os
import shutil
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.controllers.contract_controller import ContractController

router = APIRouter()

class ContractLineInput(BaseModel):
    item_code: str
    description: str
    uom: Optional[str] = "NOS"
    rate: float

class CreateContractInput(BaseModel):
    contract_id: str
    supplier_id: str
    supplier_name: str
    start_date: str
    end_date: str
    value_cap: float
    consumed_value: Optional[float] = 0.0
    lines: List[ContractLineInput] = []

@router.get("")
def list_contracts(db: Session = Depends(get_db)):
    controller = ContractController(db)
    return controller.get_all()

@router.post("/upload-pdf")
async def upload_contract_pdf(
    file: UploadFile = File(...),
    added_by: str = Form("Buyer"),
    db: Session = Depends(get_db)
):
    try:
        # Save uploaded PDF to contracts/pdf/
        save_dir = os.path.join(settings.DATA_DIR, "contracts", "pdf")
        os.makedirs(save_dir, exist_ok=True)
        file_path = os.path.join(save_dir, file.filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        controller = ContractController(db)
        return controller.extract_and_create_from_pdf(file_path, added_by=added_by)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process contract PDF: {e}")

@router.post("/manual")
def create_manual_contract(req: CreateContractInput, added_by: Optional[str] = "Buyer", db: Session = Depends(get_db)):
    controller = ContractController(db)
    return controller.create_contract_manual(req.dict(), added_by=added_by or "Buyer")
