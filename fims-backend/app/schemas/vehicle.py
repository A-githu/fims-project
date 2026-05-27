from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from app.models.vehicle import VehicleStatus, FuelType


class VehicleCreate(BaseModel):
    plate_number: str = Field(..., example="LT-1234-CM")
    brand: str = Field(..., example="Toyota")
    model: str = Field(..., example="HiLux")
    year: int = Field(..., example=2021)
    fuel_type: FuelType = Field(..., example="diesel")
    current_mileage: int = Field(default=0, example=45000)
    department_id: Optional[UUID] = Field(None, example=None)
    next_revision_date: Optional[date] = Field(None, example="2025-12-01")
    photos: Optional[List[str]] = Field(default=[], example=[])
    documents: Optional[List[str]] = Field(default=[], example=[])


class VehicleUpdate(BaseModel):
    """Modification partielle — tous les champs sont optionnels"""
    brand: Optional[str] = Field(None, max_length=50)
    model: Optional[str] = Field(None, max_length=50)
    year: Optional[int] = Field(None, ge=1990, le=2030)
    fuel_type: Optional[FuelType] = None
    current_mileage: Optional[int] = Field(None, ge=0)
    status: Optional[VehicleStatus] = None
    department_id: Optional[UUID] = None
    next_revision_date: Optional[date] = None
    photos: Optional[List[str]] = None
    documents: Optional[List[str]] = None


class VehicleOut(BaseModel):
    """Réponse complète véhicule"""
    id: UUID
    plate_number: str
    brand: str
    model: str
    year: int
    fuel_type: FuelType
    current_mileage: int
    status: VehicleStatus
    department_id: Optional[UUID]
    next_revision_date: Optional[date]
    photos: List[str]
    documents: List[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VehicleOutMinimal(BaseModel):
    """Pour les listes déroulantes et les attributions"""
    id: UUID
    plate_number: str
    brand: str
    model: str
    status: VehicleStatus

    model_config = {"from_attributes": True}