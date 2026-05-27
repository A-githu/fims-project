from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, func, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    agent           = "agent"
    manager         = "manager"
    admin           = "admin"
    unit_supervisor = "unit_supervisor"  # Responsable d'unité — lecture seule son parc


class User(Base):
    __tablename__ = "users"

    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name             = Column(String(150), nullable=False)
    email                 = Column(String(255), unique=True, nullable=False, index=True)
    password_hash         = Column(String(255), nullable=False)
    role                  = Column(Enum(UserRole), nullable=False, default=UserRole.agent)

    # Département en texte libre (ex: "SUPPORT LOGISTIQUE", "DIRECTION TECHNIQUE")
    # C'est CE champ qui sert au filtrage pour le supervisor
    department            = Column(String(100), nullable=True)

    # Lien FK vers la table departments (optionnel, pour jointures futures)
    department_id         = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)

    is_active             = Column(Boolean, default=True)
    failed_login_attempts = Column(Integer, default=0)
    created_at            = Column(DateTime, server_default=func.now())
    updated_at            = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ── Relations ──────────────────────────────────────────────────────
    department_rel = relationship(
        "Department",
        back_populates="users",
        foreign_keys=[department_id]
    )
    missions    = relationship("Mission",     foreign_keys="Mission.agent_id",     back_populates="agent")
    inspections = relationship("Inspection",  back_populates="agent")