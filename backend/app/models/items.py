from sqlalchemy import Column, String, Float
from app.core.database import Base

class Item(Base):
    __tablename__ = "items"

    item_code = Column(String(50), primary_key=True)
    description = Column(String(255), nullable=False, index=True)
    uom = Column(String(20), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    item_type = Column(String(50), nullable=False)
    standard_price = Column(Float, nullable=False)
