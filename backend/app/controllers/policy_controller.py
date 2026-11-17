import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.repositories import PolicyRepository, AuditLogRepository
from app.services.ai_store import ai_store

class PolicyController:
    def __init__(self, db: Session):
        self.db = db
        self.policy_repo = PolicyRepository(db)
        self.audit_repo = AuditLogRepository(db)

    def get_all(self) -> List[Dict[str, Any]]:
        policies = self.policy_repo.get_all()
        return [{
            "id": p.id,
            "version": p.version,
            "document_id": p.document_id,
            "title": p.title,
            "effective_date": str(p.effective_date),
            "status": p.status,
            "change_summary": p.change_summary,
            "rules_count": len(p.rules),
            "created_at": str(p.created_at),
            "approved_at": str(p.approved_at) if p.approved_at else None,
            "approved_by": p.approved_by,
            "rules_config": p.rules_config
        } for p in policies]

    def get_active(self, as_of_date: Optional[datetime.date] = None) -> Optional[Dict[str, Any]]:
        p = self.policy_repo.get_active_policy(as_of_date)
        if not p:
            return None
        return {
            "id": p.id,
            "version": p.version,
            "document_id": p.document_id,
            "title": p.title,
            "effective_date": str(p.effective_date),
            "status": p.status,
            "change_summary": p.change_summary,
            "rules_config": p.rules_config
        }

    def preview_amendment(self, amendment_text: str) -> Dict[str, Any]:
        current_active = self.policy_repo.get_active_policy()
        current_config = current_active.rules_config if current_active else {}
        parsed = ai_store.parse_policy_amendment(amendment_text, current_config)
        return parsed

    def create_amendment_draft(self, parsed_data: Dict[str, Any], raw_text: str, created_by: str = "Buyer") -> Dict[str, Any]:
        version = parsed_data.get("new_version", "5.1")
        eff_date = datetime.date.today()
        try:
            eff_date = datetime.datetime.strptime(parsed_data["effective_date"], "%Y-%m-%d").date()
        except Exception:
            pass

        pol = self.policy_repo.create_policy(
            version=version,
            title=f"Corvo Procurement Policy Amendment v{version}",
            effective_date=eff_date,
            rules_config=parsed_data.get("updated_rules_config", {}),
            document_id=parsed_data.get("document_id", "CORVO-PROC-POL-04"),
            status="PENDING_APPROVAL",
            raw_text=raw_text,
            change_summary=parsed_data.get("change_summary"),
            approved_by=None
        )

        self.audit_repo.log(
            entity_type="POLICY",
            entity_id=str(pol.id),
            action="CREATE_AMENDMENT_DRAFT",
            performed_by=created_by,
            comment=f"Created policy amendment draft v{version} effective {eff_date}",
            payload_json=parsed_data
        )

        return {
            "success": True,
            "policy_id": pol.id,
            "version": pol.version,
            "status": pol.status,
            "plain_language_preview": parsed_data.get("plain_language_preview", "")
        }

    def approve_policy(self, policy_id: int, approved_by: str = "Head of Procurement") -> Dict[str, Any]:
        pol = self.policy_repo.update_policy_status(policy_id, status="ACTIVE", approved_by=approved_by)
        if not pol:
            return {"success": False, "error": "Policy not found"}

        self.audit_repo.log(
            entity_type="POLICY",
            entity_id=str(policy_id),
            action="APPROVE_AND_ACTIVATE",
            performed_by=approved_by,
            comment=f"Approved and activated policy v{pol.version} effective {pol.effective_date}"
        )

        return {
            "success": True,
            "policy_id": pol.id,
            "version": pol.version,
            "status": pol.status,
            "effective_date": str(pol.effective_date),
            "approved_by": pol.approved_by,
            "approved_at": str(pol.approved_at)
        }

    def reject_policy(self, policy_id: int, rejected_by: str = "Head of Procurement", reason: str = "") -> Dict[str, Any]:
        pol = self.policy_repo.update_policy_status(policy_id, status="REJECTED")
        if not pol:
            return {"success": False, "error": "Policy not found"}

        self.audit_repo.log(
            entity_type="POLICY",
            entity_id=str(policy_id),
            action="REJECT",
            performed_by=rejected_by,
            comment=f"Rejected policy v{pol.version}. Reason: {reason}"
        )

        return {
            "success": True,
            "policy_id": pol.id,
            "version": pol.version,
            "status": pol.status
        }
