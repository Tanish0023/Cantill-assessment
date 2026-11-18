from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.controllers.data_controller import DataController
from app.repositories import ItemRepository, SupplierRepository, PlantRepository, ContractRepository

router = APIRouter()

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    controller = DataController(db)
    return controller.get_stats()

@router.post("/reimport")
@router.post("/seed")
def reimport_master_data(db: Session = Depends(get_db)):
    controller = DataController(db)
    counts = controller.import_all()
    return {"message": "Data seeded successfully", "counts": counts}

@router.get("/items")
def list_items(db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    items = repo.get_all()
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
    repo = SupplierRepository(db)
    suppliers = repo.get_all()
    return [{
        "supplier_id": s.supplier_id,
        "name": s.name,
        "city": s.city,
        "categories": s.categories,
        "status": s.status,
        "on_time_pct": s.on_time_pct,
        "quality_rating": s.quality_rating
    } for s in suppliers]

@router.get("/plants")
def list_plants(db: Session = Depends(get_db)):
    repo = PlantRepository(db)
    plants = repo.get_all()
    return [{"plant": p.plant, "name": p.name} for p in plants]
