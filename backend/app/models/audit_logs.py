from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(50), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    performed_by = Column(String(100), default="Buyer")
    comment = Column(Text, nullable=True)
    payload_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
