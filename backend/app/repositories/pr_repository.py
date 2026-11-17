import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import PurchaseRequest, PRLine

class PurchaseRequestRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_pr_no(self, pr_no: str) -> Optional[PurchaseRequest]:
        return self.db.query(PurchaseRequest).filter_by(pr_no=pr_no).first()

    def get_lines_for_pr(self, pr_no: str) -> List[PRLine]:
        return self.db.query(PRLine).filter_by(pr_no=pr_no).order_by(PRLine.pr_line).all()

    def get_all(self, limit: int = 100) -> List[PurchaseRequest]:
        return self.db.query(PurchaseRequest).order_by(PurchaseRequest.created_at.desc()).limit(limit).all()

    def get_recent_chat_prs(self, limit: int = 20) -> List[PurchaseRequest]:
        return self.db.query(PurchaseRequest).filter_by(source="CHAT").order_by(PurchaseRequest.created_at.desc()).limit(limit).all()

    def count(self) -> int:
        return self.db.query(PurchaseRequest).count()

    def count_lines(self) -> int:
        return self.db.query(PRLine).count()

    def create_pr(self, pr_no: str, plant: str, requester: Optional[str] = None, department: Optional[str] = None, created_at: Optional[datetime.datetime] = None, status: str = "SUBMITTED", source: str = "BATCH") -> PurchaseRequest:
        pr = PurchaseRequest(
            pr_no=pr_no,
            requester=requester,
            department=department,
            plant=plant,
            created_at=created_at or datetime.datetime.utcnow(),
            status=status,
            source=source
        )
        self.db.add(pr)
        self.db.commit()
        self.db.refresh(pr)
        return pr

    def create_pr_line(self, pr_no: str, pr_line: int, description: str, quantity: float, need_by_date: datetime.date, input_item_code: Optional[str] = None, resolved_item_code: Optional[str] = None, uom: Optional[str] = "NOS", estimated_unit_price: Optional[float] = None, urgency: str = "Normal", created_at: Optional[datetime.datetime] = None) -> PRLine:
        line = PRLine(
            pr_no=pr_no,
            pr_line=pr_line,
            input_item_code=input_item_code,
            resolved_item_code=resolved_item_code,
            description=description,
            quantity=quantity,
            uom=uom,
            estimated_unit_price=estimated_unit_price,
            need_by_date=need_by_date,
            urgency=urgency,
            created_at=created_at or datetime.datetime.utcnow()
        )
        self.db.add(line)
        self.db.commit()
        self.db.refresh(line)
        return line

    def clear_all(self):
        self.db.query(PRLine).delete()
        self.db.query(PurchaseRequest).delete()
        self.db.commit()
