from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.models.inspection import AgentConclusion, ManagerDecision


class InspectionCheckItem(BaseModel):
    """Un point de contrôle individuel dans la grille"""
    status: str = Field(..., pattern="^(conforme|surveiller|non_conforme)$")
    comment: Optional[str] = None


class InspectionData(BaseModel):
    """
    Grille complète d'inspection — Section B du formulaire.
    Chaque clé correspond à un point de contrôle.
    """
    # EXTÉRIEUR
    pneumatiques: InspectionCheckItem
    eclairages: InspectionCheckItem
    retroviseurs: InspectionCheckItem
    carrosserie: InspectionCheckItem

    # INTÉRIEUR
    ceintures: InspectionCheckItem
    tableau_de_bord: InspectionCheckItem
    klaxon: InspectionCheckItem
    climatisation: InspectionCheckItem

    # MOTEUR
    niveau_huile: InspectionCheckItem
    batterie: InspectionCheckItem
    etat_moteur: InspectionCheckItem
    liquide_refroidissement: InspectionCheckItem


class InspectionCreate(BaseModel):
    mission_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    mileage_at_inspection: int = Field(..., example=45320)
    inspection_data: InspectionData
    observations: Optional[str] = Field(None, example="Légère usure sur le pneu avant gauche. À surveiller.")
    agent_conclusion: AgentConclusion = Field(..., example="warning")
    photos: Optional[List[str]] = Field(default=[], example=[])

class InspectionManagerAction(BaseModel):
    """Action du Manager sur une inspection (validation ou refus)"""
    comment: Optional[str] = Field(None, max_length=1000, description="Obligatoire en cas de refus")


class InspectionOut(BaseModel):
    """Réponse complète d'une inspection"""
    id: UUID
    mission_id: UUID
    vehicle_id: UUID
    agent_id: UUID
    mileage_at_inspection: int
    inspection_data: Dict[str, Any]      # JSONB — renvoyé tel quel
    observations: Optional[str]
    agent_conclusion: AgentConclusion
    photos: List[str]
    manager_decision: ManagerDecision
    manager_comment: Optional[str]
    submitted_at: datetime
    decided_at: Optional[datetime]

    model_config = {"from_attributes": True}