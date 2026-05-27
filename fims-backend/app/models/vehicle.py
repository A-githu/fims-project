from sqlalchemy import Column, String, Integer, Date, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid, enum
from app.database import Base

class VehicleStatus(str, enum.Enum):
    active = "active"           # Disponible
    in_mission = "in_mission"   # En mission (attribué)
    maintenance = "maintenance" # En maintenance
    blocked = "blocked"         # Bloqué (inapte)
    decommissioned = "decommissioned"  # Hors service

class FuelType(str, enum.Enum):
    essence = "essence"
    diesel = "diesel"
    hybride = "hybride"
    electrique = "electrique"

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plate_number = Column(String(20), unique=True, nullable=False)
    brand = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    fuel_type = Column(Enum(FuelType), nullable=False)
    current_mileage = Column(Integer, default=0)
    status = Column(Enum(VehicleStatus), nullable=False, default=VehicleStatus.active)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    next_revision_date = Column(Date, nullable=True)
    photos = Column(JSONB, default=[])
    documents = Column(JSONB, default=[])
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relations - back_populates doit correspondre exactement à department.py
    department = relationship("Department", back_populates="vehicles", foreign_keys=[department_id])
    missions = relationship("Mission", back_populates="vehicle")
    inspections = relationship("Inspection", back_populates="vehicle")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="vehicle")