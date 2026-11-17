from sqlalchemy import Column, Integer, String, Float, Date, JSON
from app.core.database import Base

class SupplierRanking(Base):
    __tablename__ = "supplier_rankings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    as_of_date = Column(Date, nullable=False, index=True)
    item_code = Column(String(50), nullable=False, index=True)
    rank = Column(Integer, nullable=False)
    supplier_id = Column(String(50), nullable=False)
    supplier_name = Column(String(255), nullable=True)
    reference_price = Column(Float, nullable=False)
    score = Column(Float, nullable=False)
    details_json = Column(JSON, nullable=True)
