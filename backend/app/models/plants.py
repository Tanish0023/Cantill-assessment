from sqlalchemy import Column, String
from app.core.database import Base

class Plant(Base):
    __tablename__ = "plants"

    plant = Column(String(10), primary_key=True)
    name = Column(String(255), nullable=False)
