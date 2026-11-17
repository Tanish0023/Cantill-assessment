from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import Supplier

class SupplierRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, supplier_id: str) -> Optional[Supplier]:
        return self.db.query(Supplier).filter_by(supplier_id=supplier_id).first()

    def get_all(self) -> List[Supplier]:
        return self.db.query(Supplier).order_by(Supplier.supplier_id).all()

    def get_active(self) -> List[Supplier]:
        return self.db.query(Supplier).filter_by(status="Active").all()

    def get_active_by_category(self, category: str) -> List[Supplier]:
        return self.db.query(Supplier).filter(
            Supplier.status == "Active",
            Supplier.categories.like(f"%{category}%")
        ).all()

    def count(self) -> int:
        return self.db.query(Supplier).count()

    def upsert(self, supplier_id: str, name: str, city: str, categories: str, status: str, on_time_pct: float, quality_rating: float) -> Supplier:
        s = self.get_by_id(supplier_id)
        if not s:
            s = Supplier(supplier_id=supplier_id)
            self.db.add(s)
        s.name = name
        s.city = city
        s.categories = categories
        s.status = status
        s.on_time_pct = on_time_pct
        s.quality_rating = quality_rating
        self.db.commit()
        self.db.refresh(s)
        return s
