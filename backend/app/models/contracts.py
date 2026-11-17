from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Contract(Base):
    __tablename__ = "contracts"

    contract_id = Column(String(50), primary_key=True)
    supplier_id = Column(String(50), ForeignKey("suppliers.supplier_id"), nullable=False)
    supplier_name = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    value_cap = Column(Float, nullable=False)
    consumed_value = Column(Float, default=0.0)
    source_type = Column(String(20), default="REGISTER") # REGISTER or PDF
    document_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lines = relationship("ContractLine", back_populates="contract", cascade="all, delete-orphan")

class ContractLine(Base):
    __tablename__ = "contract_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(String(50), ForeignKey("contracts.contract_id"), index=True)
    item_code = Column(String(50), ForeignKey("items.item_code"), index=True)
    description = Column(String(255), nullable=False)
    uom = Column(String(20), nullable=False)
    rate = Column(Float, nullable=False)

    contract = relationship("Contract", back_populates="lines")
