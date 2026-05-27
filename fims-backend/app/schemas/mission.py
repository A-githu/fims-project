from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from app.models.mission import MissionStatus
from app.schemas.user import UserOutMinimal
from app.schemas.vehicle import VehicleOutMinimal


class MissionCreate(BaseModel):
    mission_date: date = Field(..., example="2025-05-15")
    destination: str = Field(..., example="Douala — Site Bassa")
    purpose: str = Field(..., example="Inspection technique du réseau électrique")
    estimated_duration: Optional[int] = Field(None, example=4)

class MissionAssign(BaseModel):
    vehicle_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")

class MissionReject(BaseModel):
    comment: str = Field(..., min_length=10, example="Véhicule déjà réservé pour une autre mission prioritaire.")

class MissionOut(BaseModel):
    """Réponse complète d'une mission"""
    id: UUID
    agent_id: UUID
    vehicle_id: Optional[UUID]
    manager_id: Optional[UUID]
    mission_date: date
    destination: str
    purpose: str
    estimated_duration: Optional[int]
    status: MissionStatus
    manager_comment: Optional[str]
    vehicle_attempt_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MissionOutDetailed(MissionOut):
    """Version enrichie avec les objets liés — pour la vue détail"""

    agent: Optional[UserOutMinimal] = None
    vehicle: Optional[VehicleOutMinimal] = None
    manager: Optional[UserOutMinimal] = None

    model_config = {"from_attributes": True}