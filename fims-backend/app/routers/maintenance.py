import logging
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.maintenance import MaintenanceTask, MaintenanceStatus
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.user import User, UserRole
from app.core.dependencies import get_current_user, require_role

logger = logging.getLogger("fims")
router = APIRouter(prefix="/api/maintenance", tags=["Maintenance - Taches de Reparation"])


# ============================================================================
# SCHEMAS PYDANTIC
# ============================================================================

class MaintenanceCreate(BaseModel):
    vehicle_id: uuid.UUID = Field(..., description="UUID du véhicule concerné")
    inspection_id: Optional[uuid.UUID] = Field(None, description="UUID de l'inspection liée (optionnel)")
    title: str = Field(..., min_length=3, max_length=200, example="Remplacement pneu avant gauche")
    description: Optional[str] = Field(None, example="Pneu usé à 90% - remplacement urgent")
    due_date: Optional[datetime] = Field(None, example="2025-06-20T08:00:00")


class MaintenanceUpdate(BaseModel):
    title: Optional[str] = Field(None, example="Remplacement pneu avant gauche")
    description: Optional[str] = Field(None, example="Effectué le 15/06/2025")
    status: Optional[str] = Field(None, description="pending | in_progress | done | validated")
    due_date: Optional[datetime] = Field(None, example="2025-06-20T08:00:00")
    resolved_at: Optional[datetime] = Field(None, example="2025-06-15T14:30:00")


class MaintenanceComplete(BaseModel):
    closure_note: str = Field(..., min_length=5, max_length=500, description="Note de clôture")


class MaintenanceOut(BaseModel):
    id: uuid.UUID
    vehicle_id: uuid.UUID
    vehicle_plate: Optional[str] = None
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None
    inspection_id: Optional[uuid.UUID] = None
    created_by: uuid.UUID
    creator_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str
    due_date: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    fault_date: Optional[datetime] = None
    priority: Optional[str] = None
    provider: Optional[str] = None
    estimated_cost: Optional[float] = None
    notes: Optional[str] = None
    closure_note: Optional[str] = None

    class Config:
        from_attributes = True


# Helper pour convertir le statut string en enum
def get_status_enum(status_str: str) -> MaintenanceStatus:
    status_map = {
        "pending": MaintenanceStatus.pending,
        "in_progress": MaintenanceStatus.in_progress,
        "done": MaintenanceStatus.done,
        "validated": MaintenanceStatus.validated,
    }
    return status_map.get(status_str, MaintenanceStatus.pending)


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/", response_model=List[MaintenanceOut])
async def list_tasks(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    """Liste toutes les tâches de maintenance"""
    try:
        query = select(MaintenanceTask).order_by(MaintenanceTask.created_at.desc())
        
        if status:
            status_enum = get_status_enum(status)
            query = query.where(MaintenanceTask.status == status_enum)
        
        result = await db.execute(query)
        tasks = result.scalars().all()
        
        # Enrichir avec les infos véhicule et créateur
        output = []
        for task in tasks:
            # Récupérer les infos du véhicule
            vehicle_plate = None
            vehicle_brand = None
            vehicle_model = None
            if task.vehicle_id:
                v_result = await db.execute(select(Vehicle).where(Vehicle.id == task.vehicle_id))
                vehicle = v_result.scalar_one_or_none()
                if vehicle:
                    vehicle_plate = vehicle.plate_number
                    vehicle_brand = vehicle.brand
                    vehicle_model = vehicle.model
            
            # Récupérer le nom du créateur
            creator_name = None
            if task.created_by:
                u_result = await db.execute(select(User).where(User.id == task.created_by))
                creator = u_result.scalar_one_or_none()
                if creator:
                    creator_name = creator.full_name
            
            output.append({
                "id": task.id,
                "vehicle_id": task.vehicle_id,
                "vehicle_plate": vehicle_plate,
                "vehicle_brand": vehicle_brand,
                "vehicle_model": vehicle_model,
                "inspection_id": task.inspection_id,
                "created_by": task.created_by,
                "creator_name": creator_name,
                "title": task.title,
                "description": task.description,
                "status": task.status.value if task.status else "pending",
                "due_date": task.due_date,
                "resolved_at": task.resolved_at,
                "created_at": task.created_at,
                "updated_at": task.updated_at,
                "fault_date": None,
                "priority": None,
                "provider": None,
                "estimated_cost": None,
                "notes": None,
                "closure_note": None,
            })
        
        return output
        
    except Exception as e:
        logger.error(f"[MAINT][LIST] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.post("/", response_model=MaintenanceOut, status_code=201)
async def create_task(
    body: MaintenanceCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    """
    Crée une tâche de maintenance.
    ✅ Le véhicule passe automatiquement en statut 'maintenance'
    """
    try:
        # 1. Vérifier que le véhicule existe
        v_result = await db.execute(select(Vehicle).where(Vehicle.id == body.vehicle_id))
        vehicle = v_result.scalar_one_or_none()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Véhicule {body.vehicle_id} introuvable.")
        
        # 2. Créer la tâche de maintenance
        task = MaintenanceTask(
            vehicle_id=body.vehicle_id,
            inspection_id=body.inspection_id,
            created_by=user.id,
            title=body.title,
            description=body.description,
            due_date=body.due_date,
            status=MaintenanceStatus.pending
        )
        db.add(task)
        
        # 3. ✅ METTRE LE VÉHICULE EN MAINTENANCE (FORCÉ)
        await db.execute(
            update(Vehicle)
            .where(Vehicle.id == body.vehicle_id)
            .values(status=VehicleStatus.maintenance)
        )
        
        await db.commit()
        await db.refresh(task)
        
        logger.info(f"[MAINT] Tâche créée par {user.email} : {task.title} - Véhicule {vehicle.plate_number} passé en maintenance")
        
        return {
            "id": task.id,
            "vehicle_id": task.vehicle_id,
            "vehicle_plate": vehicle.plate_number,
            "vehicle_brand": vehicle.brand,
            "vehicle_model": vehicle.model,
            "inspection_id": task.inspection_id,
            "created_by": task.created_by,
            "creator_name": user.full_name,
            "title": task.title,
            "description": task.description,
            "status": task.status.value,
            "due_date": task.due_date,
            "resolved_at": task.resolved_at,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "fault_date": None,
            "priority": None,
            "provider": None,
            "estimated_cost": None,
            "notes": None,
            "closure_note": None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MAINT][CREATE] {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/{task_id}", response_model=MaintenanceOut)
async def get_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    try:
        result = await db.execute(select(MaintenanceTask).where(MaintenanceTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail=f"Tâche {task_id} introuvable.")
        
        # Récupérer les infos véhicule
        vehicle_plate = None
        vehicle_brand = None
        vehicle_model = None
        if task.vehicle_id:
            v_result = await db.execute(select(Vehicle).where(Vehicle.id == task.vehicle_id))
            vehicle = v_result.scalar_one_or_none()
            if vehicle:
                vehicle_plate = vehicle.plate_number
                vehicle_brand = vehicle.brand
                vehicle_model = vehicle.model
        
        # Récupérer le nom du créateur
        creator_name = None
        if task.created_by:
            u_result = await db.execute(select(User).where(User.id == task.created_by))
            creator = u_result.scalar_one_or_none()
            if creator:
                creator_name = creator.full_name
        
        return {
            "id": task.id,
            "vehicle_id": task.vehicle_id,
            "vehicle_plate": vehicle_plate,
            "vehicle_brand": vehicle_brand,
            "vehicle_model": vehicle_model,
            "inspection_id": task.inspection_id,
            "created_by": task.created_by,
            "creator_name": creator_name,
            "title": task.title,
            "description": task.description,
            "status": task.status.value if task.status else "pending",
            "due_date": task.due_date,
            "resolved_at": task.resolved_at,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "fault_date": None,
            "priority": None,
            "provider": None,
            "estimated_cost": None,
            "notes": None,
            "closure_note": None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MAINT][GET] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.put("/{task_id}", response_model=MaintenanceOut)
async def update_task(
    task_id: uuid.UUID,
    body: MaintenanceUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    """Met à jour une tâche de maintenance"""
    try:
        result = await db.execute(select(MaintenanceTask).where(MaintenanceTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail=f"Tâche {task_id} introuvable.")
        
        # Mettre à jour les champs
        if body.title is not None:
            task.title = body.title
        if body.description is not None:
            task.description = body.description
        if body.due_date is not None:
            task.due_date = body.due_date
        if body.resolved_at is not None:
            task.resolved_at = body.resolved_at
        if body.status is not None:
            status_map = {
                "pending": MaintenanceStatus.pending,
                "in_progress": MaintenanceStatus.in_progress,
                "done": MaintenanceStatus.done,
                "validated": MaintenanceStatus.validated,
            }
            if body.status in status_map:
                task.status = status_map[body.status]
        
        task.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(task)
        
        # Récupérer les infos véhicule
        vehicle_plate = None
        vehicle_brand = None
        vehicle_model = None
        if task.vehicle_id:
            v_result = await db.execute(select(Vehicle).where(Vehicle.id == task.vehicle_id))
            vehicle = v_result.scalar_one_or_none()
            if vehicle:
                vehicle_plate = vehicle.plate_number
                vehicle_brand = vehicle.brand
                vehicle_model = vehicle.model
        
        creator_name = None
        if task.created_by:
            u_result = await db.execute(select(User).where(User.id == task.created_by))
            creator = u_result.scalar_one_or_none()
            if creator:
                creator_name = creator.full_name
        
        return {
            "id": task.id,
            "vehicle_id": task.vehicle_id,
            "vehicle_plate": vehicle_plate,
            "vehicle_brand": vehicle_brand,
            "vehicle_model": vehicle_model,
            "inspection_id": task.inspection_id,
            "created_by": task.created_by,
            "creator_name": creator_name,
            "title": task.title,
            "description": task.description,
            "status": task.status.value if task.status else "pending",
            "due_date": task.due_date,
            "resolved_at": task.resolved_at,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "fault_date": None,
            "priority": None,
            "provider": None,
            "estimated_cost": None,
            "notes": None,
            "closure_note": None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MAINT][UPDATE] {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


# ============================================================================
# ✅ ENDPOINT SPÉCIAL - CLÔTURE DE MAINTENANCE
# ============================================================================

@router.put("/{task_id}/complete", response_model=MaintenanceOut)
async def complete_maintenance(
    task_id: uuid.UUID,
    body: MaintenanceComplete,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    """
    Clôture une tâche de maintenance.
    ✅ Le véhicule repasse automatiquement en statut 'active'
    """
    try:
        result = await db.execute(select(MaintenanceTask).where(MaintenanceTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail=f"Tâche {task_id} introuvable.")
        
        # Vérifier la note de clôture
        if not body.closure_note or len(body.closure_note.strip()) < 5:
            raise HTTPException(status_code=400, detail="La note de clôture est obligatoire (minimum 5 caractères)")
        
        # Mettre à jour la tâche
        task.status = MaintenanceStatus.done
        task.resolved_at = datetime.utcnow()
        task.updated_at = datetime.utcnow()
        
        # ✅ LIBÉRER LE VÉHICULE → repasse en actif
        await db.execute(
            update(Vehicle)
            .where(Vehicle.id == task.vehicle_id)
            .values(status=VehicleStatus.active)
        )
        
        await db.commit()
        await db.refresh(task)
        
        # Récupérer les infos véhicule
        vehicle_plate = None
        vehicle_brand = None
        vehicle_model = None
        if task.vehicle_id:
            v_result = await db.execute(select(Vehicle).where(Vehicle.id == task.vehicle_id))
            vehicle = v_result.scalar_one_or_none()
            if vehicle:
                vehicle_plate = vehicle.plate_number
                vehicle_brand = vehicle.brand
                vehicle_model = vehicle.model
        
        creator_name = None
        if task.created_by:
            u_result = await db.execute(select(User).where(User.id == task.created_by))
            creator = u_result.scalar_one_or_none()
            if creator:
                creator_name = creator.full_name
        
        logger.info(f"[MAINT] Tâche {task_id} clôturée par {user.email} - Véhicule {vehicle_plate} remis en service")
        
        return {
            "id": task.id,
            "vehicle_id": task.vehicle_id,
            "vehicle_plate": vehicle_plate,
            "vehicle_brand": vehicle_brand,
            "vehicle_model": vehicle_model,
            "inspection_id": task.inspection_id,
            "created_by": task.created_by,
            "creator_name": creator_name,
            "title": task.title,
            "description": task.description,
            "status": task.status.value,
            "due_date": task.due_date,
            "resolved_at": task.resolved_at,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "fault_date": None,
            "priority": None,
            "provider": None,
            "estimated_cost": None,
            "notes": None,
            "closure_note": body.closure_note,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MAINT][COMPLETE] {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.delete("/{task_id}")
async def delete_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.admin))
):
    """Supprime une tâche de maintenance (Admin uniquement)"""
    try:
        result = await db.execute(select(MaintenanceTask).where(MaintenanceTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail=f"Tâche {task_id} introuvable.")
        
        # Si la tâche n'est pas terminée, libérer le véhicule
        if task.status != MaintenanceStatus.done:
            await db.execute(
                update(Vehicle)
                .where(Vehicle.id == task.vehicle_id)
                .values(status=VehicleStatus.active)
            )
            logger.info(f"[MAINT] Véhicule {task.vehicle_id} libéré suite à suppression de tâche")
        
        await db.delete(task)
        await db.commit()
        
        return {"message": f"Tâche '{task.title}' supprimée avec succès."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MAINT][DELETE] {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")