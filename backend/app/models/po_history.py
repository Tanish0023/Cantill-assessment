from sqlalchemy import Column, Integer, String, Float, Boolean, Date, ForeignKey
from app.core.database import Base

class PurchaseOrderHistory(Base):
    __tablename__ = "po_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    po_number = Column(String(50), index=True)
    po_date = Column(Date, nullable=False, index=True)
    supplier_id = Column(String(50), ForeignKey("suppliers.supplier_id"), index=True)
    item_code = Column(String(50), ForeignKey("items.item_code"), index=True)
    quantity = Column(Float, nullable=False)
    uom = Column(String(20), nullable=False)
    unit_price = Column(Float, nullable=False)
    plant = Column(String(10), ForeignKey("plants.plant"), nullable=False)
    delivered_on_time = Column(Boolean, default=True)
