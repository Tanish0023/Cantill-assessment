from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    pr_no = Column(String(50), primary_key=True)
    requester = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    plant = Column(String(20), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, index=True)
    status = Column(String(50), default="SUBMITTED")
    source = Column(String(50), default="BATCH")

    lines = relationship("PRLine", back_populates="purchase_request", cascade="all, delete-orphan")

class PRLine(Base):
    __tablename__ = "pr_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pr_no = Column(String(50), ForeignKey("purchase_requests.pr_no"), index=True)
    pr_line = Column(Integer, nullable=False)
    input_item_code = Column(String(50), nullable=True)
    resolved_item_code = Column(String(50), nullable=True)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False)
    uom = Column(String(20), nullable=True)
    estimated_unit_price = Column(Float, nullable=True)
    need_by_date = Column(Date, nullable=False)
    urgency = Column(String(20), default="Normal")
    created_at = Column(DateTime, nullable=False)
    group_id = Column(String(50), nullable=True, index=True)

    purchase_request = relationship("PurchaseRequest", back_populates="lines")
