from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import Plant

class PlantRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[Plant]:
        return self.db.query(Plant).all()

    def get_by_id(self, plant_id: str) -> Optional[Plant]:
        return self.db.query(Plant).filter_by(plant=plant_id).first()

    def count(self) -> int:
        return self.db.query(Plant).count()

    def upsert(self, plant_id: str, name: str) -> Plant:
        p = self.get_by_id(plant_id)
        if not p:
            p = Plant(plant=plant_id, name=name)
            self.db.add(p)
        else:
            p.name = name
        self.db.commit()
        self.db.refresh(p)
        return p
