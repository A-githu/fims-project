import logging
import uuid
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.mission import Mission, MissionStatus
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.user import User, UserRole
from app.models.inspection import Inspection
from app.core.dependencies import get_current_user, require_role

logger = logging.getLogger("fims")
router = APIRouter(prefix="/api/missions", tags=["Missions - Workflow Principal"])


# ============================================================================
# SCHEMAS PYDANTIC
# ============================================================================

class MissionCreate(BaseModel):
    mission_date: date = Field(..., example="2026-06-15")
    destination: str = Field(..., min_length=3, max_length=200, example="Douala — Site Bassa")
    purpose: str = Field(..., min_length=5, example="Inspection technique")
    estimated_duration: Optional[int] = Field(None, ge=0, le=72, example=4)
    department: Optional[str] = Field(None, max_length=100, example="Direction Technique")


class MissionAssign(BaseModel):
    vehicle_id: uuid.UUID = Field(..., description="UUID du véhicule actif à attribuer")


class MissionReject(BaseModel):
    comment: str = Field(..., min_length=10, example="Aucun besoin urgent identifié.")


class MissionComment(BaseModel):
    comment: str = Field(..., min_length=3, max_length=500)


class MissionCompleteBody(BaseModel):
    final_mileage: Optional[int] = Field(None, ge=0, description="Kilométrage final (optionnel)")
    notes: Optional[str] = Field(None, max_length=500, description="Notes de fin de mission")


class MissionOut(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    vehicle_id: Optional[uuid.UUID] = None
    manager_id: Optional[uuid.UUID] = None
    mission_date: date
    destination: str
    purpose: str
    estimated_duration: Optional[int] = None
    department: Optional[str] = None
    status: MissionStatus
    manager_comment: Optional[str] = None
    vehicle_attempt_count: int = 0
    created_at: datetime
    updated_at: datetime
    agent: Optional[dict] = None
    vehicle: Optional[dict] = None
    manager: Optional[dict] = None
    
    class Config:
        from_attributes = True


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/", response_model=MissionOut, status_code=201)
async def create_mission(
    body: MissionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.agent, UserRole.manager, UserRole.admin))
):
    """Agent crée une demande de mission"""
    try:
        if body.mission_date < date.today():
            raise HTTPException(status_code=400, detail="La date de mission ne peut pas être dans le passé.")
        
        mission = Mission(
            mission_date=body.mission_date,
            destination=body.destination,
            purpose=body.purpose,
            estimated_duration=body.estimated_duration,
            department=body.department,
            agent_id=user.id,
            status=MissionStatus.EN_ATTENTE_ATTRIBUTION
        )
        db.add(mission)
        await db.commit()
        await db.refresh(mission)
        
        logger.info(f"[MISSIONS] Mission créée par {user.email} - status: EN_ATTENTE_ATTRIBUTION")
        
        return {
            "id": mission.id,
            "agent_id": mission.agent_id,
            "vehicle_id": mission.vehicle_id,
            "manager_id": mission.manager_id,
            "mission_date": mission.mission_date,
            "destination": mission.destination,
            "purpose": mission.purpose,
            "estimated_duration": mission.estimated_duration,
            "department": mission.department,
            "status": mission.status,
            "manager_comment": mission.manager_comment,
            "vehicle_attempt_count": mission.vehicle_attempt_count,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at,
            "agent": {"id": str(user.id), "full_name": user.full_name},
            "vehicle": None,
            "manager": None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MISSIONS][CREATE] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/", response_model=List[MissionOut])
async def list_missions(
    status: Optional[MissionStatus] = None,
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    """Lister les missions selon le rôle : Agent voit ses missions, Manager voit toutes"""
    try:
        query = select(Mission).order_by(Mission.created_at.desc())
        
        # Agent: uniquement ses missions | Manager/Admin: toutes
        if user.role == UserRole.agent:
            query = query.where(Mission.agent_id == user.id)
        
        if status:
            query = query.where(Mission.status == status)
        
        result = await db.execute(query)
        missions = result.scalars().all()
        
        # Enrichir avec les relations
        output = []
        for mission in missions:
            mission_dict = {
                "id": mission.id,
                "agent_id": mission.agent_id,
                "vehicle_id": mission.vehicle_id,
                "manager_id": mission.manager_id,
                "mission_date": mission.mission_date,
                "destination": mission.destination,
                "purpose": mission.purpose,
                "estimated_duration": mission.estimated_duration,
                "department": mission.department,
                "status": mission.status,
                "manager_comment": mission.manager_comment,
                "vehicle_attempt_count": mission.vehicle_attempt_count,
                "created_at": mission.created_at,
                "updated_at": mission.updated_at,
                "agent": None,
                "vehicle": None,
                "manager": None
            }
            
            # Charger l'agent
            if mission.agent_id:
                agent_result = await db.execute(select(User).where(User.id == mission.agent_id))
                agent = agent_result.scalar_one_or_none()
                if agent:
                    mission_dict["agent"] = {"id": str(agent.id), "full_name": agent.full_name, "email": agent.email}
            
            # Charger le véhicule
            if mission.vehicle_id:
                vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == mission.vehicle_id))
                vehicle = vehicle_result.scalar_one_or_none()
                if vehicle:
                    mission_dict["vehicle"] = {
                        "id": str(vehicle.id),
                        "plate_number": vehicle.plate_number,
                        "brand": vehicle.brand,
                        "model": vehicle.model,
                        "current_mileage": vehicle.current_mileage
                    }
            
            # Charger le manager
            if mission.manager_id:
                manager_result = await db.execute(select(User).where(User.id == mission.manager_id))
                manager = manager_result.scalar_one_or_none()
                if manager:
                    mission_dict["manager"] = {"id": str(manager.id), "full_name": manager.full_name}
            
            output.append(mission_dict)
        
        return output
    except Exception as e:
        logger.error(f"[MISSIONS][LIST] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/pending", response_model=List[MissionOut])
async def list_pending_missions(
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(require_role(UserRole.manager, UserRole.admin))
):
    """Missions en attente d'attribution pour le Manager"""
    try:
        query = select(Mission).where(
            Mission.status.in_([MissionStatus.EN_ATTENTE_ATTRIBUTION, MissionStatus.NOUVEAU_VEHICULE_REQUIS])
        ).order_by(Mission.created_at.asc())
        
        result = await db.execute(query)
        missions = result.scalars().all()
        
        output = []
        for mission in missions:
            mission_dict = {
                "id": mission.id,
                "agent_id": mission.agent_id,
                "vehicle_id": mission.vehicle_id,
                "manager_id": mission.manager_id,
                "mission_date": mission.mission_date,
                "destination": mission.destination,
                "purpose": mission.purpose,
                "estimated_duration": mission.estimated_duration,
                "department": mission.department,
                "status": mission.status,
                "manager_comment": mission.manager_comment,
                "vehicle_attempt_count": mission.vehicle_attempt_count,
                "created_at": mission.created_at,
                "updated_at": mission.updated_at,
                "agent": None,
                "vehicle": None
            }
            
            if mission.agent_id:
                agent_result = await db.execute(select(User).where(User.id == mission.agent_id))
                agent = agent_result.scalar_one_or_none()
                if agent:
                    mission_dict["agent"] = {"id": str(agent.id), "full_name": agent.full_name, "email": agent.email}
            
            if mission.vehicle_id:
                vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == mission.vehicle_id))
                vehicle = vehicle_result.scalar_one_or_none()
                if vehicle:
                    mission_dict["vehicle"] = {"id": str(vehicle.id), "plate_number": vehicle.plate_number}
            
            output.append(mission_dict)
        
        return output
    except Exception as e:
        logger.error(f"[MISSIONS][PENDING] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/available", response_model=List[dict])
async def get_available_vehicles(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.manager, UserRole.admin))
):
    """Retourne UNIQUEMENT les véhicules en statut 'active' (disponibles)"""
    try:
        result = await db.execute(
            select(Vehicle).where(Vehicle.status == VehicleStatus.active)
            .order_by(Vehicle.plate_number)
        )
        vehicles = result.scalars().all()
        return [
            {
                "id": str(v.id),
                "plate_number": v.plate_number,
                "brand": v.brand,
                "model": v.model,
                "current_mileage": v.current_mileage,
                "fuel_type": v.fuel_type
            }
            for v in vehicles
        ]
    except Exception as e:
        logger.error(f"[MISSIONS][AVAILABLE] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/{mission_id}", response_model=MissionOut)
async def get_mission(
    mission_id: uuid.UUID, 
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    try:
        result = await db.execute(select(Mission).where(Mission.id == mission_id))
        mission = result.scalar_one_or_none()
        if not mission:
            raise HTTPException(status_code=404, detail=f"Mission {mission_id} introuvable.")
        
        if user.role == UserRole.agent and mission.agent_id != user.id:
            raise HTTPException(status_code=403, detail="Accès refusé")
        
        mission_dict = {
            "id": mission.id,
            "agent_id": mission.agent_id,
            "vehicle_id": mission.vehicle_id,
            "manager_id": mission.manager_id,
            "mission_date": mission.mission_date,
            "destination": mission.destination,
            "purpose": mission.purpose,
            "estimated_duration": mission.estimated_duration,
            "department": mission.department,
            "status": mission.status,
            "manager_comment": mission.manager_comment,
            "vehicle_attempt_count": mission.vehicle_attempt_count,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at,
            "agent": None,
            "vehicle": None
        }
        
        if mission.agent_id:
            agent_result = await db.execute(select(User).where(User.id == mission.agent_id))
            agent = agent_result.scalar_one_or_none()
            if agent:
                mission_dict["agent"] = {"id": str(agent.id), "full_name": agent.full_name}
        
        if mission.vehicle_id:
            vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == mission.vehicle_id))
            vehicle = vehicle_result.scalar_one_or_none()
            if vehicle:
                mission_dict["vehicle"] = {
                    "id": str(vehicle.id),
                    "plate_number": vehicle.plate_number,
                    "brand": vehicle.brand,
                    "model": vehicle.model,
                    "current_mileage": vehicle.current_mileage
                }
        
        return mission_dict
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MISSIONS][GET] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.put("/{mission_id}/assign", response_model=MissionOut)
async def assign_vehicle(
    mission_id: uuid.UUID,
    body: MissionAssign,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.manager, UserRole.admin))
):
    """Manager attribue un véhicule à une mission"""
    try:
        # 1. Récupérer la mission
        m_result = await db.execute(select(Mission).where(Mission.id == mission_id))
        mission = m_result.scalar_one_or_none()
        if not mission:
            raise HTTPException(status_code=404, detail=f"Mission {mission_id} introuvable.")
        
        # 2. Vérifier que la mission est en attente
        if mission.status not in [MissionStatus.EN_ATTENTE_ATTRIBUTION, MissionStatus.NOUVEAU_VEHICULE_REQUIS]:
            raise HTTPException(status_code=400, detail=f"La mission est en statut '{mission.status.value}'. Seules les missions en attente peuvent recevoir un véhicule.")
        
        # 3. Vérifier que le véhicule est actif (disponible)
        v_result = await db.execute(
            select(Vehicle).where(
                Vehicle.id == body.vehicle_id,
                Vehicle.status == VehicleStatus.active
            )
        )
        vehicle = v_result.scalar_one_or_none()
        if not vehicle:
            raise HTTPException(status_code=400, detail="Ce véhicule n'est pas disponible (déjà en mission ou maintenance).")
        
        # 4. 🔒 VERROUILLER LE VÉHICULE → passe en in_mission
        await db.execute(
            update(Vehicle)
            .where(Vehicle.id == body.vehicle_id)
            .values(status=VehicleStatus.in_mission)
        )
        
        # 5. Attribuer le véhicule à la mission
        mission.vehicle_id = body.vehicle_id
        mission.manager_id = user.id
        mission.status = MissionStatus.VEHICULE_ATTRIBUE
        mission.vehicle_attempt_count = (mission.vehicle_attempt_count or 0) + 1
        mission.updated_at = datetime.utcnow()
        
        if mission.vehicle_attempt_count >= 3:
            logger.critical(f"[ALERTE CRITIQUE] 3 véhicules tentés pour mission {mission_id}")
        
        await db.commit()
        await db.refresh(mission)
        
        logger.info(f"[MISSIONS] Véhicule {vehicle.plate_number} attribué - Mission {mission_id} passe en VEHICULE_ATTRIBUE")
        
        # Construire la réponse
        return {
            "id": mission.id,
            "agent_id": mission.agent_id,
            "vehicle_id": mission.vehicle_id,
            "manager_id": mission.manager_id,
            "mission_date": mission.mission_date,
            "destination": mission.destination,
            "purpose": mission.purpose,
            "estimated_duration": mission.estimated_duration,
            "department": mission.department,
            "status": mission.status,
            "manager_comment": mission.manager_comment,
            "vehicle_attempt_count": mission.vehicle_attempt_count,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at,
            "vehicle": {
                "id": str(vehicle.id),
                "plate_number": vehicle.plate_number,
                "brand": vehicle.brand,
                "model": vehicle.model,
                "current_mileage": vehicle.current_mileage
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MISSIONS][ASSIGN] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.put("/{mission_id}/reject", response_model=MissionOut)
async def reject_mission(
    mission_id: uuid.UUID,
    body: MissionReject,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.manager, UserRole.admin))
):
    """Manager rejette une demande de mission"""
    try:
        result = await db.execute(select(Mission).where(Mission.id == mission_id))
        mission = result.scalar_one_or_none()
        if not mission:
            raise HTTPException(status_code=404, detail=f"Mission {mission_id} introuvable.")
        
        if not body.comment or len(body.comment.strip()) < 10:
            raise HTTPException(status_code=400, detail="Commentaire obligatoire pour un refus (min. 10 caractères)")
        
        mission.status = MissionStatus.REJETEE
        mission.manager_comment = body.comment
        mission.manager_id = user.id
        mission.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(mission)
        
        logger.info(f"[MISSIONS] Mission {mission_id} rejetée par {user.email}")
        
        return {
            "id": mission.id,
            "agent_id": mission.agent_id,
            "vehicle_id": mission.vehicle_id,
            "manager_id": mission.manager_id,
            "mission_date": mission.mission_date,
            "destination": mission.destination,
            "purpose": mission.purpose,
            "estimated_duration": mission.estimated_duration,
            "department": mission.department,
            "status": mission.status,
            "manager_comment": mission.manager_comment,
            "vehicle_attempt_count": mission.vehicle_attempt_count,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MISSIONS][REJECT] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.put("/{mission_id}/cancel", response_model=MissionOut)
async def cancel_mission(
    mission_id: uuid.UUID,
    body: MissionComment,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.agent, UserRole.manager, UserRole.admin))
):
    """Agent annule sa demande de mission"""
    try:
        result = await db.execute(select(Mission).where(Mission.id == mission_id))
        mission = result.scalar_one_or_none()
        if not mission:
            raise HTTPException(status_code=404, detail=f"Mission {mission_id} introuvable.")
        
        if user.role == UserRole.agent and mission.agent_id != user.id:
            raise HTTPException(status_code=403, detail="Vous ne pouvez annuler que vos propres missions.")
        
        if mission.status in [MissionStatus.TERMINEE, MissionStatus.REJETEE]:
            raise HTTPException(status_code=400, detail="Cette mission est déjà terminée ou rejetée.")
        
        # 🔓 Si un véhicule était attribué, le libérer
        if mission.vehicle_id and mission.status == MissionStatus.VEHICULE_ATTRIBUE:
            await db.execute(
                update(Vehicle)
                .where(Vehicle.id == mission.vehicle_id)
                .values(status=VehicleStatus.active)
            )
            logger.info(f"[MISSIONS] Véhicule {mission.vehicle_id} libéré suite à annulation")
        
        mission.status = MissionStatus.REJETEE
        mission.manager_comment = f"Annulée par l'agent : {body.comment}"
        mission.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(mission)
        
        logger.info(f"[MISSIONS] Mission {mission_id} annulée par {user.email}")
        return {
            "id": mission.id,
            "agent_id": mission.agent_id,
            "vehicle_id": mission.vehicle_id,
            "manager_id": mission.manager_id,
            "mission_date": mission.mission_date,
            "destination": mission.destination,
            "purpose": mission.purpose,
            "estimated_duration": mission.estimated_duration,
            "department": mission.department,
            "status": mission.status,
            "manager_comment": mission.manager_comment,
            "vehicle_attempt_count": mission.vehicle_attempt_count,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MISSIONS][CANCEL] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")



@router.put("/{mission_id}/complete", response_model=MissionOut)
async def complete_mission(
    mission_id: uuid.UUID,
    body: MissionCompleteBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.agent, UserRole.manager, UserRole.admin))
):
    """
    L'agent déclare sa mission terminée.
    Précondition : Mission en statut APPROUVEE uniquement.
    """
    try:
        # 1. Récupérer la mission
        m_result = await db.execute(select(Mission).where(Mission.id == mission_id))
        mission = m_result.scalar_one_or_none()
        if not mission:
            raise HTTPException(status_code=404, detail="Mission introuvable.")
        
        # 2. Vérifier les droits
        if user.role == UserRole.agent and mission.agent_id != user.id:
            raise HTTPException(status_code=403, detail="Vous ne pouvez terminer que vos propres missions.")
        
        # 3. Vérifier que la mission est APPROUVEE
        if mission.status != MissionStatus.APPROUVEE:
            raise HTTPException(
                status_code=400,
                detail=f"Impossible de terminer : la mission est en statut '{mission.status.value}'. Elle doit être APPROUVEE."
            )
        
        # 4. Terminer la mission
        mission.status = MissionStatus.TERMINEE
        mission.updated_at = datetime.utcnow()
        if body.notes:
            mission.manager_comment = f"[Fin de mission] {body.notes}"
        
        # 5. 🔓 LIBÉRER LE VÉHICULE → repasse à active
        vehicle_info = None
        if mission.vehicle_id:
            update_data = {"status": VehicleStatus.active}
            if body.final_mileage:
                update_data["current_mileage"] = body.final_mileage
            
            v_result = await db.execute(select(Vehicle).where(Vehicle.id == mission.vehicle_id))
            vehicle = v_result.scalar_one_or_none()
            if vehicle:
                vehicle_info = {
                    "id": str(vehicle.id),
                    "plate_number": vehicle.plate_number,
                    "brand": vehicle.brand,
                    "model": vehicle.model
                }
            
            await db.execute(
                update(Vehicle)
                .where(Vehicle.id == mission.vehicle_id)
                .values(**update_data)
            )
            logger.info(f"[MISSIONS] Véhicule {mission.vehicle_id} libéré - Mission terminée par {user.email}")
        
        await db.commit()
        await db.refresh(mission)
        
        logger.info(f"[MISSIONS] Mission {mission_id} terminée par {user.email} - status: TERMINEE")
        
        return {
            "id": mission.id,
            "agent_id": mission.agent_id,
            "vehicle_id": mission.vehicle_id,
            "manager_id": mission.manager_id,
            "mission_date": mission.mission_date,
            "destination": mission.destination,
            "purpose": mission.purpose,
            "estimated_duration": mission.estimated_duration,
            "department": mission.department,
            "status": mission.status,
            "manager_comment": mission.manager_comment,
            "vehicle_attempt_count": mission.vehicle_attempt_count,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at,
            "vehicle": vehicle_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MISSIONS][COMPLETE] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")

