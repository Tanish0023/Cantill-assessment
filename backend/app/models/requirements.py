from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, Date, DateTime
from app.core.database import Base

class Requirement(Base):
    __tablename__ = "requirements"

    group_id = Column(String(50), primary_key=True)
    resolved_item_code = Column(String(50), nullable=False, index=True)
    plant = Column(String(10), nullable=False, index=True)
    total_quantity = Column(Float, nullable=False)
    uom = Column(String(20), nullable=True)
    unit_price = Column(Float, nullable=False)
    group_value_inr = Column(Float, nullable=False)
    valuation_method = Column(String(50), nullable=False)
    requirement_date = Column(Date, nullable=False, index=True)
    earliest_need_by = Column(Date, nullable=False)
    latest_need_by = Column(Date, nullable=False)
    is_emergency = Column(Boolean, default=False)
    status = Column(String(50), default="PENDING")
    created_at = Column(DateTime, nullable=False)
