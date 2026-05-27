from sqlalchemy import Column, Text, Integer, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid, enum
from app.database import Base

class AgentConclusion(str, enum.Enum):
    fit = "fit"
    warning = "warning"
    unfit = "unfit"

class ManagerDecision(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"
    pending = "pending"

class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mission_id = Column(UUID(as_uuid=True), ForeignKey("missions.id"), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    mileage_at_inspection = Column(Integer, nullable=False)
    inspection_data = Column(JSONB, nullable=False)   # Grille complète
    observations = Column(Text, nullable=True)
    agent_conclusion = Column(Enum(AgentConclusion), nullable=False)
    photos = Column(JSONB, default=[])                # URLs photos
    manager_decision = Column(Enum(ManagerDecision), default=ManagerDecision.pending)
    manager_comment = Column(Text, nullable=True)
    submitted_at = Column(DateTime, server_default=func.now())
    decided_at = Column(DateTime, nullable=True)

    mission = relationship("Mission", back_populates="inspections")
    vehicle = relationship("Vehicle", back_populates="inspections")
    agent = relationship("User", back_populates="inspections")