from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from app.core.database import Base

class ConsolidatedPO(Base):
    __tablename__ = "consolidated_pos"

    po_id = Column(String(50), primary_key=True)
    supplier_id = Column(String(50), nullable=False)
    plant = Column(String(10), nullable=False)
    route = Column(String(50), nullable=False)
    first_requirement_time = Column(DateTime, nullable=False)
    status = Column(String(50), default="DRAFT")
    created_at = Column(DateTime, default=datetime.utcnow)

class Decision(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(String(50), ForeignKey("requirements.group_id"), unique=True, index=True)
    po_id = Column(String(50), ForeignKey("consolidated_pos.po_id"), nullable=True, index=True)
    decision = Column(String(50), nullable=False)
    route = Column(String(50), nullable=False)
    supplier_id = Column(String(50), nullable=True)
    unit_price = Column(Float, nullable=True)
    group_value_inr = Column(Float, nullable=False)
    suggested_supplier_ids = Column(String(255), nullable=True)
    policy_version = Column(String(20), nullable=False)
    applied_clause = Column(String(50), nullable=False)
    reference_doc = Column(String(100), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="AUTO_GENERATED")
    override_reason = Column(Text, nullable=True)
    acted_by = Column(String(100), nullable=True)
    acted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
