from sqlalchemy import Column, String, Text, Date, DateTime, Enum, ForeignKey, func, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid, enum
from app.database import Base

class MissionStatus(str, enum.Enum):
    DEMANDE_CREEE = "DEMANDE_CREEE"
    EN_ATTENTE_ATTRIBUTION = "EN_ATTENTE_ATTRIBUTION"
    VEHICULE_ATTRIBUE = "VEHICULE_ATTRIBUE"
    INSPECTION_EN_COURS = "INSPECTION_EN_COURS"
    INSPECTION_SOUMISE = "INSPECTION_SOUMISE"
    APPROUVEE = "APPROUVEE"
    NOUVEAU_VEHICULE_REQUIS = "NOUVEAU_VEHICULE_REQUIS"
    TERMINEE = "TERMINEE"
    REJETEE = "REJETEE"

class Mission(Base):
    __tablename__ = "missions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    mission_date = Column(Date, nullable=False)
    destination = Column(String(200), nullable=False)
    start_location = Column(String(200), nullable=True)
    end_location = Column(String(200), nullable=True)
    purpose = Column(Text, nullable=False)
    estimated_duration = Column(Integer, nullable=True)
    department = Column(String(100), nullable=True)
    status = Column(Enum(MissionStatus), nullable=False, default=MissionStatus.DEMANDE_CREEE)
    manager_comment = Column(Text, nullable=True)
    vehicle_attempt_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relations
    agent = relationship("User", foreign_keys=[agent_id], back_populates="missions")
    manager = relationship("User", foreign_keys=[manager_id])
    vehicle = relationship("Vehicle", back_populates="missions")
    inspections = relationship("Inspection", back_populates="mission")