import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.repositories import DecisionRepository, AuditLogRepository, ItemRepository, SupplierRepository

from app.models import Requirement, Decision, Item, Supplier

class BuyerController:
    def __init__(self, db: Session):
        self.db = db
        self.decision_repo = DecisionRepository(db)
        self.audit_repo = AuditLogRepository(db)
        self.item_repo = ItemRepository(db)
        self.supplier_repo = SupplierRepository(db)

    def get_workspace_requirements_paginated(
        self,
        limit: Optional[int] = 20,
        offset: int = 0,
        plant: Optional[str] = None,
        status: Optional[str] = None,
        route: Optional[str] = None,
        search: Optional[str] = None
    ) -> tuple[List[Dict[str, Any]], int]:
        query = (
            self.db.query(Requirement, Decision)
            .outerjoin(Decision, Requirement.group_id == Decision.group_id)
        )

        if plant and plant != "ALL":
            query = query.filter(Requirement.plant == plant)

        if status and status != "ALL":
            if status == "AUTO_GENERATED":
                query = query.filter((Decision.status == "AUTO_GENERATED") | (Decision.status.is_(None)))
            else:
                query = query.filter(Decision.status == status)

        if route and route != "ALL":
            query = query.filter(Decision.route == route)

        if search and search.strip():
            s = f"%{search.strip()}%"
            query = query.filter(
                (Requirement.group_id.ilike(s)) |
                (Requirement.resolved_item_code.ilike(s)) |
                (Decision.po_id.ilike(s))
            )

        total_count = query.count()

        query = query.order_by(
            Requirement.requirement_date.desc(),
            Requirement.created_at.desc(),
            Requirement.group_id
        )

        if offset > 0:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)

        rows = query.all()
        if not rows:
            return [], total_count

        item_codes = {r.resolved_item_code for r, _ in rows if r.resolved_item_code}
        supplier_ids = {d.supplier_id for _, d in rows if d and d.supplier_id}

        items_map = {}
        if item_codes:
            items = self.db.query(Item.item_code, Item.description).filter(Item.item_code.in_(item_codes)).all()
            items_map = {i.item_code: i.description for i in items}

        suppliers_map = {}
        if supplier_ids:
            suppliers = self.db.query(Supplier.supplier_id, Supplier.name).filter(Supplier.supplier_id.in_(supplier_ids)).all()
            suppliers_map = {s.supplier_id: s.name for s in suppliers}

        results = []
        for r, d in rows:
            item_desc = items_map.get(r.resolved_item_code, r.resolved_item_code)
            supp_name = suppliers_map.get(d.supplier_id) if d and d.supplier_id else None

            results.append({
                "group_id": r.group_id,
                "item_code": r.resolved_item_code,
                "item_description": item_desc,
                "plant": r.plant,
                "total_quantity": r.total_quantity,
                "uom": r.uom,
                "unit_price": r.unit_price,
                "group_value_inr": r.group_value_inr,
                "requirement_date": str(r.requirement_date),
                "earliest_need_by": str(r.earliest_need_by),
                "is_emergency": r.is_emergency,
                "status": d.status if d else r.status,
                "decision": {
                    "id": d.id if d else None,
                    "po_id": d.po_id if d else None,
                    "decision": d.decision if d else None,
                    "route": d.route if d else None,
                    "supplier_id": d.supplier_id if d else None,
                    "supplier_name": supp_name,
                    "unit_price": d.unit_price if d else None,
                    "group_value_inr": d.group_value_inr if d else None,
                    "suggested_supplier_ids": d.suggested_supplier_ids if d else None,
                    "policy_version": d.policy_version if d else None,
                    "applied_clause": d.applied_clause if d else None,
                    "reference_doc": d.reference_doc if d else None,
                    "reason": d.reason if d else None,
                    "status": d.status if d else "AUTO_GENERATED",
                    "override_reason": d.override_reason if d else None,
                    "acted_by": d.acted_by if d else None,
                    "acted_at": str(d.acted_at) if d and d.acted_at else None
                } if d else None
            })
        return results, total_count

    def get_workspace_requirements(
        self,
        limit: Optional[int] = None,
        offset: int = 0,
        plant: Optional[str] = None,
        status: Optional[str] = None,
        route: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        results, _ = self.get_workspace_requirements_paginated(
            limit=limit,
            offset=offset,
            plant=plant,
            status=status,
            route=route,
            search=search
        )
        return results

    def get_requirement_details(self, group_id: str) -> Optional[Dict[str, Any]]:
        r = self.decision_repo.get_requirement_by_id(group_id)
        if not r:
            return None
        d = self.decision_repo.get_decision_by_group_id(group_id)
        item = self.item_repo.get_by_code(r.resolved_item_code)
        supp = self.supplier_repo.get_by_id(d.supplier_id) if d and d.supplier_id else None
        audits = self.audit_repo.get_by_entity("DECISION", group_id)

        return {
            "requirement": {
                "group_id": r.group_id,
                "item_code": r.resolved_item_code,
                "item_description": item.description if item else r.resolved_item_code,
                "plant": r.plant,
                "total_quantity": r.total_quantity,
                "uom": r.uom,
                "unit_price": r.unit_price,
                "group_value_inr": r.group_value_inr,
                "valuation_method": r.valuation_method,
                "requirement_date": str(r.requirement_date),
                "earliest_need_by": str(r.earliest_need_by),
                "latest_need_by": str(r.latest_need_by),
                "is_emergency": r.is_emergency
            },
            "decision": {
                "id": d.id if d else None,
                "po_id": d.po_id if d else None,
                "decision": d.decision if d else None,
                "route": d.route if d else None,
                "supplier_id": d.supplier_id if d else None,
                "supplier_name": supp.name if supp else None,
                "unit_price": d.unit_price if d else None,
                "group_value_inr": d.group_value_inr if d else None,
                "suggested_supplier_ids": d.suggested_supplier_ids if d else None,
                "policy_version": d.policy_version if d else None,
                "applied_clause": d.applied_clause if d else None,
                "reference_doc": d.reference_doc if d else None,
                "reason": d.reason if d else None,
                "status": d.status if d else "AUTO_GENERATED",
                "override_reason": d.override_reason if d else None,
                "acted_by": d.acted_by if d else None,
                "acted_at": str(d.acted_at) if d and d.acted_at else None
            } if d else None,
            "audit_trail": [{
                "id": a.id,
                "action": a.action,
                "performed_by": a.performed_by,
                "comment": a.comment,
                "timestamp": str(a.timestamp)
            } for a in audits]
        }

    def approve_decision(self, group_id: str, buyer_name: str = "Buyer") -> Dict[str, Any]:
        d = self.decision_repo.update_decision_action(group_id, status="APPROVED", acted_by=buyer_name)
        if not d:
            return {"success": False, "error": "Decision not found"}

        self.audit_repo.log(
            entity_type="DECISION",
            entity_id=group_id,
            action="APPROVE",
            performed_by=buyer_name,
            comment=f"Buyer approved decision for {group_id}: Route={d.route}, Decision={d.decision}"
        )

        return {"success": True, "group_id": group_id, "status": "APPROVED", "po_id": d.po_id}

    def override_decision(self, group_id: str, new_route: str, reason: str, new_supplier_id: Optional[str] = None, buyer_name: str = "Buyer") -> Dict[str, Any]:
        if not reason or not reason.strip():
            return {"success": False, "error": "Mandatory written reason required for decision override."}

        d = self.decision_repo.get_decision_by_group_id(group_id)
        if not d:
            return {"success": False, "error": "Decision not found"}

        original_summary = f"Route={d.route}, Supplier={d.supplier_id}, Price={d.unit_price}"
        
        # Maintain original in override explanation
        d.status = "OVERRIDDEN"
        d.acted_by = buyer_name
        d.acted_at = datetime.datetime.utcnow()
        d.override_reason = f"Overridden by {buyer_name}: {reason.strip()} [Original: {original_summary}]"
        d.route = new_route
        if new_supplier_id:
            d.supplier_id = new_supplier_id
        if "PO" in new_route:
            d.decision = "PO"
        else:
            d.decision = "SOURCING_REQUEST"
        self.db.commit()

        self.audit_repo.log(
            entity_type="DECISION",
            entity_id=group_id,
            action="OVERRIDE",
            performed_by=buyer_name,
            comment=f"Overrode {group_id} to {new_route}. Reason: {reason}",
            payload_json={"original": original_summary, "new_route": new_route, "reason": reason}
        )

        return {"success": True, "group_id": group_id, "status": "OVERRIDDEN", "new_route": new_route}

    def get_audit_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        logs = self.audit_repo.get_all(limit=limit)
        return [{
            "id": l.id,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "action": l.action,
            "performed_by": l.performed_by,
            "comment": l.comment,
            "timestamp": str(l.timestamp)
        } for l in logs]
