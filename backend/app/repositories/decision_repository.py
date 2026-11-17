import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import Requirement, Decision, ConsolidatedPO

class DecisionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_requirements(self) -> List[Requirement]:
        return self.db.query(Requirement).order_by(Requirement.requirement_date.desc(), Requirement.created_at.desc()).all()

    def get_requirement_by_id(self, group_id: str) -> Optional[Requirement]:
        return self.db.query(Requirement).filter_by(group_id=group_id).first()

    def get_decision_by_group_id(self, group_id: str) -> Optional[Decision]:
        return self.db.query(Decision).filter_by(group_id=group_id).first()

    def get_all_decisions(self) -> List[Decision]:
        return self.db.query(Decision).order_by(Decision.created_at.desc()).all()

    def get_all_pos(self) -> List[ConsolidatedPO]:
        return self.db.query(ConsolidatedPO).order_by(ConsolidatedPO.created_at.desc()).all()

    def upsert_requirement(self, group_id: str, resolved_item_code: str, plant: str, total_quantity: float, unit_price: float, group_value_inr: float, valuation_method: str, requirement_date: datetime.date, earliest_need_by: datetime.date, latest_need_by: datetime.date, is_emergency: bool = False, uom: Optional[str] = "NOS", status: str = "PENDING") -> Requirement:
        req = self.get_requirement_by_id(group_id)
        if not req:
            req = Requirement(group_id=group_id)
            self.db.add(req)
        req.resolved_item_code = resolved_item_code
        req.plant = plant
        req.total_quantity = total_quantity
        req.unit_price = unit_price
        req.group_value_inr = group_value_inr
        req.valuation_method = valuation_method
        req.requirement_date = requirement_date
        req.earliest_need_by = earliest_need_by
        req.latest_need_by = latest_need_by
        req.is_emergency = is_emergency
        req.uom = uom
        req.status = status
        req.created_at = datetime.datetime.utcnow()
        self.db.commit()
        self.db.refresh(req)
        return req

    def upsert_consolidated_po(self, po_id: str, supplier_id: str, plant: str, route: str, first_requirement_time: datetime.datetime, status: str = "DRAFT") -> ConsolidatedPO:
        po = self.db.query(ConsolidatedPO).filter_by(po_id=po_id).first()
        if not po:
            po = ConsolidatedPO(
                po_id=po_id,
                supplier_id=supplier_id,
                plant=plant,
                route=route,
                first_requirement_time=first_requirement_time,
                status=status
            )
            self.db.add(po)
        else:
            po.supplier_id = supplier_id
            po.plant = plant
            po.route = route
            po.status = status
        self.db.commit()
        self.db.refresh(po)
        return po

    def upsert_decision(self, group_id: str, decision: str, route: str, group_value_inr: float, policy_version: str, applied_clause: str, reason: str, po_id: Optional[str] = None, supplier_id: Optional[str] = None, unit_price: Optional[float] = None, suggested_supplier_ids: Optional[str] = None, reference_doc: Optional[str] = None, status: str = "AUTO_GENERATED") -> Decision:
        d = self.get_decision_by_group_id(group_id)
        if not d:
            d = Decision(group_id=group_id)
            self.db.add(d)
        d.po_id = po_id
        d.decision = decision
        d.route = route
        d.supplier_id = supplier_id
        d.unit_price = unit_price
        d.group_value_inr = group_value_inr
        d.suggested_supplier_ids = suggested_supplier_ids
        d.policy_version = policy_version
        d.applied_clause = applied_clause
        d.reference_doc = reference_doc
        d.reason = reason
        d.status = status
        self.db.commit()
        self.db.refresh(d)
        return d

    def update_decision_action(self, group_id: str, status: str, acted_by: str, override_reason: Optional[str] = None) -> Optional[Decision]:
        d = self.get_decision_by_group_id(group_id)
        if d:
            d.status = status
            d.acted_by = acted_by
            d.acted_at = datetime.datetime.utcnow()
            if override_reason:
                d.override_reason = override_reason
            self.db.commit()
            self.db.refresh(d)
        return d
