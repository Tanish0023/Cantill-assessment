import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import Policy, PolicyRule

class PolicyRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[Policy]:
        return self.db.query(Policy).order_by(Policy.effective_date.desc(), Policy.version.desc()).all()

    def get_by_version(self, version: str) -> Optional[Policy]:
        return self.db.query(Policy).filter_by(version=version).first()

    def get_by_id(self, policy_id: int) -> Optional[Policy]:
        return self.db.query(Policy).filter_by(id=policy_id).first()

    def count(self) -> int:
        return self.db.query(Policy).count()

    def get_active_policy(self, as_of_date: Optional[datetime.date] = None) -> Optional[Policy]:
        if as_of_date is not None:
            pol = self.db.query(Policy).filter(
                Policy.status == "ACTIVE",
                Policy.effective_date <= as_of_date
            ).order_by(Policy.effective_date.desc(), Policy.version.desc()).first()
            if pol:
                return pol
        pol = self.db.query(Policy).filter_by(status="ACTIVE").order_by(Policy.version.desc()).first()
        if not pol:
            pol = self.db.query(Policy).order_by(Policy.version.desc()).first()
        return pol

    def create_policy(self, version: str, title: str, effective_date: datetime.date, rules_config: dict, document_id: str = "CORVO-PROC-POL-04", status: str = "PENDING_APPROVAL", raw_text: Optional[str] = None, change_summary: Optional[str] = None, approved_by: Optional[str] = None) -> Policy:
        pol = Policy(
            version=version,
            document_id=document_id,
            title=title,
            effective_date=effective_date,
            status=status,
            rules_config=rules_config,
            raw_text=raw_text,
            change_summary=change_summary,
            approved_by=approved_by,
            approved_at=datetime.datetime.utcnow() if status == "ACTIVE" else None
        )
        self.db.add(pol)
        self.db.commit()
        self.db.refresh(pol)

        # Create rules
        for r in rules_config.get("rules", []):
            rule_obj = PolicyRule(
                policy_id=pol.id,
                rule_number=r.get("rule_number", ""),
                rule_name=r.get("rule_name", ""),
                priority=r.get("priority", 1),
                condition_type=r.get("condition_type", ""),
                condition_params=r.get("condition_params", {}),
                outcome_route=r.get("outcome_route", ""),
                outcome_decision=r.get("outcome_decision", ""),
                clause_reference=r.get("clause_reference", ""),
                description=r.get("description", ""),
                is_active=True
            )
            self.db.add(rule_obj)
        self.db.commit()
        return pol

    def update_policy_status(self, policy_id: int, status: str, approved_by: Optional[str] = None) -> Optional[Policy]:
        pol = self.get_by_id(policy_id)
        if pol:
            pol.status = status
            if status == "ACTIVE":
                pol.approved_at = datetime.datetime.utcnow()
                pol.approved_by = approved_by or "Head of Procurement"
            self.db.commit()
            self.db.refresh(pol)
        return pol
