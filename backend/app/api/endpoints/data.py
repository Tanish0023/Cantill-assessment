from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.models import Plant, Item, Supplier, Contract, ContractLine, Policy, PurchaseRequest, PRLine, PurchaseOrderHistory
from app.services.data_import import import_all_master_data

router = APIRouter()

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    return {
        "plants": db.query(Plant).count(),
        "items": db.query(Item).count(),
        "suppliers": db.query(Supplier).count(),
        "contracts": db.query(Contract).count(),
        "contract_lines": db.query(ContractLine).count(),
        "po_history": db.query(PurchaseOrderHistory).count(),
        "policies": db.query(Policy).count(),
        "purchase_requests": db.query(PurchaseRequest).count(),
        "pr_lines": db.query(PRLine).count(),
    }

@router.post("/reimport")
def reimport_master_data(db: Session = Depends(get_db)):
    counts = import_all_master_data(db)
    return {"message": "Data imported successfully", "counts": counts}

@router.get("/items")
def list_items(db: Session = Depends(get_db)):
    items = db.query(Item).all()
    return [{
        "item_code": i.item_code,
        "description": i.description,
        "uom": i.uom,
        "category": i.category,
        "item_type": i.item_type,
        "standard_price": i.standard_price
    } for i in items]

@router.get("/suppliers")
def list_suppliers(db: Session = Depends(get_db)):
    suppliers = db.query(Supplier).all()
    return [{
        "supplier_id": s.supplier_id,
        "name": s.name,
        "city": s.city,
        "categories": s.categories,
        "status": s.status,
        "on_time_pct": s.on_time_pct,
        "quality_rating": s.quality_rating
    } for s in suppliers]

@router.get("/contracts")
def list_contracts(db: Session = Depends(get_db)):
    contracts = db.query(Contract).all()
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

@router.get("/plants")
def list_plants(db: Session = Depends(get_db)):
    plants = db.query(Plant).all()
    return [{"plant": p.plant, "name": p.name} for p in plants]
