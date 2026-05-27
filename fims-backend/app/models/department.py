from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.database import Base

class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relations corrigées - le nom back_populates doit correspondre exactement
    users = relationship("User", back_populates="department_rel")
    vehicles = relationship("Vehicle", back_populates="department")