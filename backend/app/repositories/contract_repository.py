import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models import Contract, ContractLine, Supplier

class ContractRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[Contract]:
        return self.db.query(Contract).order_by(Contract.contract_id).all()

    def get_by_id(self, contract_id: str) -> Optional[Contract]:
        return self.db.query(Contract).filter_by(contract_id=contract_id).first()

    def count(self) -> int:
        return self.db.query(Contract).count()

    def count_lines(self) -> int:
        return self.db.query(ContractLine).count()

    def get_all_lines(self) -> List[ContractLine]:
        return self.db.query(ContractLine).all()

    def get_contracts_for_item(self, item_code: str, as_of_date: datetime.date) -> List[Tuple[ContractLine, Contract]]:
        return self.db.query(ContractLine, Contract).join(
            Contract, ContractLine.contract_id == Contract.contract_id
        ).filter(
            ContractLine.item_code == item_code,
            Contract.start_date <= as_of_date
        ).all()

    def get_active_contracts_covering_item(self, item_code: str, as_of_date: datetime.date) -> List[Tuple[ContractLine, Contract]]:
        return self.db.query(ContractLine, Contract).join(
            Contract, ContractLine.contract_id == Contract.contract_id
        ).join(
            Supplier, Contract.supplier_id == Supplier.supplier_id
        ).filter(
            ContractLine.item_code == item_code,
            Contract.start_date <= as_of_date,
            Contract.end_date >= as_of_date,
            Supplier.status == "Active"
        ).all()

    def update_consumed_value(self, contract_id: str, additional_consumed: float) -> Optional[Contract]:
        c = self.get_by_id(contract_id)
        if c:
            c.consumed_value += additional_consumed
            self.db.commit()
            self.db.refresh(c)
        return c

    def upsert_contract(self, contract_id: str, supplier_id: str, supplier_name: str, start_date: datetime.date, end_date: datetime.date, value_cap: float, consumed_value: float = 0.0, source_type: str = "REGISTER", document_path: Optional[str] = None) -> Contract:
        c = self.get_by_id(contract_id)
        if not c:
            c = Contract(contract_id=contract_id)
            self.db.add(c)
        c.supplier_id = supplier_id
        c.supplier_name = supplier_name
        c.start_date = start_date
        c.end_date = end_date
        c.value_cap = value_cap
        c.consumed_value = consumed_value
        c.source_type = source_type
        if document_path:
            c.document_path = document_path
        self.db.commit()
        self.db.refresh(c)
        return c

    def add_line(self, contract_id: str, item_code: str, description: str, uom: str, rate: float) -> ContractLine:
        existing = self.db.query(ContractLine).filter_by(contract_id=contract_id, item_code=item_code).first()
        if existing:
            existing.description = description
            existing.uom = uom
            existing.rate = rate
            self.db.commit()
            self.db.refresh(existing)
            return existing
        line = ContractLine(
            contract_id=contract_id,
            item_code=item_code,
            description=description,
            uom=uom,
            rate=rate
        )
        self.db.add(line)
        self.db.commit()
        self.db.refresh(line)
        return line

    def clear_lines(self):
        self.db.query(ContractLine).delete()
        self.db.commit()
