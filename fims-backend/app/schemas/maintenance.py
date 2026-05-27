from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.maintenance import MaintenanceStatus


class MaintenanceTaskCreate(BaseModel):
    """Création manuelle ou automatique d'une tâche de maintenance"""
    vehicle_id: UUID
    inspection_id: Optional[UUID] = None   # Lié à une inspection si création automatique
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    due_date: Optional[datetime] = None


class MaintenanceTaskUpdate(BaseModel):
    """Mise à jour du statut ou des infos d'une tâche"""
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    status: Optional[MaintenanceStatus] = None
    due_date: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class MaintenanceTaskOut(BaseModel):
    """Réponse complète d'une tâche de maintenance"""
    id: UUID
    vehicle_id: UUID
    inspection_id: Optional[UUID]
    created_by: UUID
    title: str
    description: Optional[str]
    status: MaintenanceStatus
    due_date: Optional[datetime]
    resolved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}