from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import Item

class ItemRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_code(self, item_code: str) -> Optional[Item]:
        return self.db.query(Item).filter_by(item_code=item_code).first()

    def get_all(self) -> List[Item]:
        return self.db.query(Item).order_by(Item.item_code).all()

    def count(self) -> int:
        return self.db.query(Item).count()

    def find_by_description(self, description: str) -> Optional[Item]:
        return self.db.query(Item).filter(Item.description.ilike(description)).first()

    def upsert(self, item_code: str, description: str, uom: str, category: str, item_type: str, standard_price: float) -> Item:
        item = self.get_by_code(item_code)
        if not item:
            item = Item(item_code=item_code)
            self.db.add(item)
        item.description = description
        item.uom = uom
        item.category = category
        item.item_type = item_type
        item.standard_price = standard_price
        self.db.commit()
        self.db.refresh(item)
        return item
