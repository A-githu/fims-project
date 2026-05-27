from sqlalchemy import Column, String, Text, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid, enum
from app.database import Base

class MaintenanceStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    done = "done"
    validated = "validated"

class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    inspection_id = Column(UUID(as_uuid=True), ForeignKey("inspections.id"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(MaintenanceStatus), default=MaintenanceStatus.pending)
    due_date = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    vehicle = relationship("Vehicle", back_populates="maintenance_tasks")