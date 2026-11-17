import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import PurchaseOrderHistory, Supplier

class POHistoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_item(self, item_code: str, as_of_date: datetime.date, days_window: int = 548) -> List[PurchaseOrderHistory]:
        min_date = as_of_date - datetime.timedelta(days=days_window)
        return self.db.query(PurchaseOrderHistory).filter(
            PurchaseOrderHistory.item_code == item_code,
            PurchaseOrderHistory.po_date <= as_of_date,
            PurchaseOrderHistory.po_date >= min_date
        ).order_by(PurchaseOrderHistory.po_date.desc()).all()

    def get_recent_active_po(self, item_code: str, as_of_date: datetime.date, days_window: int = 365) -> Optional[PurchaseOrderHistory]:
        min_date = as_of_date - datetime.timedelta(days=days_window)
        return self.db.query(PurchaseOrderHistory).join(
            Supplier, PurchaseOrderHistory.supplier_id == Supplier.supplier_id
        ).filter(
            PurchaseOrderHistory.item_code == item_code,
            PurchaseOrderHistory.po_date <= as_of_date,
            PurchaseOrderHistory.po_date >= min_date,
            Supplier.status == "Active"
        ).order_by(PurchaseOrderHistory.po_date.desc()).first()

    def count(self) -> int:
        return self.db.query(PurchaseOrderHistory).count()

    def clear_all(self):
        self.db.query(PurchaseOrderHistory).delete()
        self.db.commit()

    def add(self, po: PurchaseOrderHistory):
        self.db.add(po)

    def commit(self):
        self.db.commit()
