from sqlalchemy import Column, String, Float
from app.core.database import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    supplier_id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False)
    categories = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, index=True) # Active, Blocked, Inactive
    on_time_pct = Column(Float, nullable=False)
    quality_rating = Column(Float, nullable=False)
