import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import AuditLog

class AuditLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def log(self, entity_type: str, entity_id: str, action: str, performed_by: str = "Buyer", comment: Optional[str] = None, payload_json: Optional[dict] = None) -> AuditLog:
        audit = AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            performed_by=performed_by,
            comment=comment,
            payload_json=payload_json,
            timestamp=datetime.datetime.utcnow()
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(audit)
        return audit

    def get_all(self, limit: int = 100) -> List[AuditLog]:
        return self.db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()

    def get_by_entity(self, entity_type: str, entity_id: str) -> List[AuditLog]:
        return self.db.query(AuditLog).filter_by(
            entity_type=entity_type,
            entity_id=entity_id
        ).order_by(AuditLog.timestamp.desc()).all()
