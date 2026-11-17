from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(String(20), unique=True, index=True) # e.g. "5.0"
    document_id = Column(String(50), default="CORVO-PROC-POL-04")
    title = Column(String(255), nullable=False)
    effective_date = Column(Date, nullable=False)
    status = Column(String(50), default="ACTIVE") # DRAFT, PENDING_APPROVAL, ACTIVE, ARCHIVED, REJECTED
    raw_text = Column(Text, nullable=True)
    change_summary = Column(Text, nullable=True)
    rules_config = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(String(100), nullable=True)

    rules = relationship("PolicyRule", back_populates="policy", cascade="all, delete-orphan")

class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    policy_id = Column(Integer, ForeignKey("policies.id"), index=True)
    rule_number = Column(String(20), nullable=False)
    rule_name = Column(String(100), nullable=False)
    priority = Column(Integer, nullable=False)
    condition_type = Column(String(50), nullable=False)
    condition_params = Column(JSON, nullable=False)
    outcome_route = Column(String(50), nullable=False)
    outcome_decision = Column(String(50), nullable=False)
    clause_reference = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    policy = relationship("Policy", back_populates="rules")
