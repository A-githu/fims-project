import logging
import uuid
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.vehicle import Vehicle, VehicleStatus, FuelType
from app.models.inspection import Inspection
from app.models.user import UserRole
from app.core.dependencies import get_current_user, require_role

logger = logging.getLogger("fims")
router = APIRouter(prefix="/api/vehicles", tags=["Véhicules"])


# ── Schémas ────────────────────────────────────────────────────────────────
class VehicleCreate(BaseModel):
    plate_number: str = Field(..., example="LT-1234-CM")
    brand: str = Field(..., example="Toyota")
    model: str = Field(..., example="HiLux")
    year: int = Field(..., ge=1990, le=2030, example=2021)
    fuel_type: FuelType = Field(..., example="diesel")
    current_mileage: int = Field(default=0, ge=0, example=45000)
    department_id: Optional[uuid.UUID] = Field(None, example=None)
    next_revision_date: Optional[date] = Field(None, example="2025-12-01")

class VehicleUpdate(BaseModel):
    brand: Optional[str] = Field(None, example="Toyota")
    model: Optional[str] = Field(None, example="Land Cruiser")
    year: Optional[int] = Field(None, ge=1990, le=2030, example=2022)
    fuel_type: Optional[FuelType] = Field(None, example="diesel")
    current_mileage: Optional[int] = Field(None, ge=0, example=50000)
    status: Optional[VehicleStatus] = Field(None, example="active")
    next_revision_date: Optional[date] = Field(None, example="2026-06-01")

class VehicleOut(BaseModel):
    id: uuid.UUID
    plate_number: str
    brand: str
    model: str
    year: int
    fuel_type: FuelType
    current_mileage: int
    status: VehicleStatus
    department_id: Optional[uuid.UUID]
    next_revision_date: Optional[date]

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────────────────────────
@router.get(
    "/",
    response_model=List[VehicleOut],
    summary="Lister tous les véhicules",
    description="**Tous rôles.** Filtre optionnel par statut : `active`, `maintenance`, `blocked`, `decommissioned`",
)
async def list_vehicles(
    status: Optional[VehicleStatus] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        query = select(Vehicle)
        if status:
            query = query.where(Vehicle.status == status)
        result = await db.execute(query)
        vehicles = result.scalars().all()
        return vehicles
    except Exception as e:
        logger.error(f"[VEHICLES][LIST] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get(
    "/available",
    response_model=List[VehicleOut],
    summary="Véhicules disponibles (actifs)",
    description="**Tous rôles.** Retourne uniquement les véhicules en statut `active` — utilisé pour l'attribution.",
)
async def list_available_vehicles(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        result = await db.execute(select(Vehicle).where(Vehicle.status == VehicleStatus.active))
        return result.scalars().all()
    except Exception as e:
        logger.error(f"[VEHICLES][AVAILABLE] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get(
    "/{vehicle_id}",
    response_model=VehicleOut,
    summary="Détail d'un véhicule",
    description="**Tous rôles.** Retourne les informations complètes d'un véhicule.",
)
async def get_vehicle(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
        vehicle = result.scalar_one_or_none()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Véhicule {vehicle_id} introuvable")
        return vehicle
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VEHICLES][GET] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.post(
    "/",
    response_model=VehicleOut,
    status_code=201,
    summary="Ajouter un véhicule au parc",
    description="**Manager / Admin.** Crée un nouveau véhicule dans le parc.",
    responses={
        201: {"description": "Véhicule ajouté au parc"},
        400: {"description": "Immatriculation déjà existante"},
    }
)
async def create_vehicle(
    body: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    try:
        existing = await db.execute(select(Vehicle).where(Vehicle.plate_number == body.plate_number))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Le véhicule {body.plate_number} existe déjà")
        vehicle = Vehicle(**body.model_dump())
        db.add(vehicle)
        await db.commit()
        await db.refresh(vehicle)
        logger.info(f"[VEHICLES] Véhicule créé : {vehicle.plate_number}")
        return vehicle
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VEHICLES][CREATE] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.put(
    "/{vehicle_id}",
    response_model=VehicleOut,
    summary="Modifier un véhicule",
    description="**Manager / Admin.** Met à jour les informations ou le statut d'un véhicule.",
)
async def update_vehicle(
    vehicle_id: uuid.UUID,
    body: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    try:
        result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
        vehicle = result.scalar_one_or_none()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Véhicule {vehicle_id} introuvable")
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(vehicle, k, v)
        await db.commit()
        await db.refresh(vehicle)
        return vehicle
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VEHICLES][UPDATE] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.delete(
    "/{vehicle_id}",
    summary="Mettre hors service un véhicule",
    description="**Admin uniquement.** Passe le véhicule en statut `decommissioned`.",
)
async def decommission_vehicle(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.admin))
):
    try:
        result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
        vehicle = result.scalar_one_or_none()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Véhicule {vehicle_id} introuvable")
        vehicle.status = VehicleStatus.decommissioned
        await db.commit()
        return {"message": f"Véhicule {vehicle.plate_number} mis hors service avec succès"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VEHICLES][DELETE] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


# ============================================================================
# ✅ NOUVEL ENDPOINT - RÉACTIVER UN VÉHICULE BLOQUÉ
# ============================================================================

@router.put(
    "/{vehicle_id}/reactivate",
    summary="Réactiver un véhicule bloqué",
    description="**Manager / Admin.** Réactive un véhicule bloqué pour le remettre dans la flotte.",
)
async def reactivate_vehicle(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    """
    Réactive un véhicule bloqué pour le remettre dans la flotte.
    Le véhicule passe du statut 'blocked' à 'active'.
    """
    try:
        result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
        vehicle = result.scalar_one_or_none()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Véhicule {vehicle_id} introuvable.")
        
        if vehicle.status != VehicleStatus.blocked:
            raise HTTPException(
                status_code=400, 
                detail=f"Seul un véhicule bloqué peut être réactivé. Statut actuel: {vehicle.status.value}"
            )
        
        vehicle.status = VehicleStatus.active
        await db.commit()
        
        logger.info(f"[VEHICLES] Véhicule {vehicle.plate_number} réactivé par {user.email}")
        
        return {
            "id": vehicle.id,
            "plate_number": vehicle.plate_number,
            "brand": vehicle.brand,
            "model": vehicle.model,
            "status": vehicle.status,
            "current_mileage": vehicle.current_mileage,
            "message": f"Véhicule {vehicle.plate_number} réactivé avec succès"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VEHICLES][REACTIVATE] {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get(
    "/{vehicle_id}/history",
    summary="Historique complet d'un véhicule",
    description="**Tous rôles.** Retourne toutes les inspections liées à ce véhicule, du plus récent au plus ancien.",
)
async def vehicle_history(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
        vehicle = result.scalar_one_or_none()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Véhicule {vehicle_id} introuvable")
        insp_result = await db.execute(
            select(Inspection)
            .where(Inspection.vehicle_id == vehicle_id)
            .order_by(Inspection.submitted_at.desc())
        )
        inspections = insp_result.scalars().all()
        return {
            "vehicle": {
                "id": str(vehicle.id),
                "plate_number": vehicle.plate_number,
                "brand": vehicle.brand,
                "model": vehicle.model,
                "status": vehicle.status,
                "current_mileage": vehicle.current_mileage,
            },
            "total_inspections": len(inspections),
            "inspections": [
                {
                    "id": str(i.id),
                    "submitted_at": i.submitted_at.isoformat() if i.submitted_at else None,
                    "agent_conclusion": i.agent_conclusion,
                    "manager_decision": i.manager_decision,
                    "mileage_at_inspection": i.mileage_at_inspection,
                    "observations": i.observations,
                }
                for i in inspections
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VEHICLES][HISTORY] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")