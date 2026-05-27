# app/routers/supervisor.py
import logging
import uuid
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.inspection import Inspection, AgentConclusion, ManagerDecision
from app.models.user import User, UserRole
from app.models.mission import Mission, MissionStatus
from app.core.dependencies import get_current_user, require_role

logger = logging.getLogger("fims")
router = APIRouter(prefix="/api/supervisor", tags=["Supervisor - Responsable d'Unité"])


# ============================================================================
# SCHEMAS PYDANTIC
# ============================================================================

class DashboardStatsOut(BaseModel):
    department_name: str
    total_vehicles: int
    vehicles_by_status: dict
    total_inspections: int
    inspections_this_month: int
    vehicles_never_inspected: int
    vehicles_not_inspected_30_days: int
    last_inspection_date: Optional[datetime]
    conformity_rate: float


class SupervisorVehicleOut(BaseModel):
    id: uuid.UUID
    plate_number: str
    brand: str
    model: str
    year: int
    fuel_type: str
    current_mileage: int
    status: str
    last_inspection_date: Optional[datetime]
    last_inspection_conclusion: Optional[str]
    last_manager_name: Optional[str]
    last_agent_name: Optional[str]
    total_inspections_count: int
    days_since_last_inspection: Optional[int]
    needs_attention: bool


class SupervisorInspectionOut(BaseModel):
    id: uuid.UUID
    vehicle_plate: Optional[str]
    vehicle_brand: Optional[str]
    vehicle_model: Optional[str]
    agent_name: Optional[str]
    manager_name: Optional[str]
    agent_conclusion: str
    manager_decision: str
    mileage_at_inspection: int
    submitted_at: Optional[datetime]
    decided_at: Optional[datetime]
    has_anomalies: bool
    observations: Optional[str]
    inspection_data: Optional[dict]


class NotifyAgentBody(BaseModel):
    agent_id: uuid.UUID
    vehicle_id: uuid.UUID
    message: Optional[str] = None


class NotifyAgentOut(BaseModel):
    success: bool
    notified_agent: str
    message: str


class SupervisorAgentOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str


# ============================================================================
# HELPERS
# ============================================================================

async def get_vehicle_last_inspection(db: AsyncSession, vehicle_id: uuid.UUID):
    """Récupère la dernière inspection d'un véhicule"""
    try:
        result = await db.execute(
            select(Inspection)
            .where(Inspection.vehicle_id == vehicle_id)
            .order_by(Inspection.submitted_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
    except Exception as e:
        logger.error(f"Erreur get_vehicle_last_inspection: {e}")
        return None


async def get_vehicle_inspections_count(db: AsyncSession, vehicle_id: uuid.UUID):
    """Compte le nombre d'inspections d'un véhicule"""
    try:
        result = await db.execute(
            select(func.count(Inspection.id)).where(Inspection.vehicle_id == vehicle_id)
        )
        return result.scalar() or 0
    except Exception as e:
        logger.error(f"Erreur get_vehicle_inspections_count: {e}")
        return 0


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/dashboard", response_model=DashboardStatsOut)
async def get_supervisor_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.unit_supervisor, UserRole.admin))
):
    """Tableau de bord du responsable d'unité"""
    try:
        department_name = user.department or "Mon unité"
        
        # ✅ CORRECTION: Utiliser department_id si disponible, sinon department text
        if user.department_id:
            v_result = await db.execute(
                select(Vehicle).where(Vehicle.department_id == user.department_id)
            )
        else:
            v_result = await db.execute(
                select(Vehicle).where(Vehicle.department.has(name=user.department))
            )
        vehicles = v_result.scalars().all()

        vehicle_ids = [v.id for v in vehicles]
        total_vehicles = len(vehicles)

        vehicles_by_status = {
            "active": len([v for v in vehicles if v.status == VehicleStatus.active]),
            "in_mission": len([v for v in vehicles if v.status == VehicleStatus.in_mission]),
            "maintenance": len([v for v in vehicles if v.status == VehicleStatus.maintenance]),
            "blocked": len([v for v in vehicles if v.status == VehicleStatus.blocked]),
            "decommissioned": len([v for v in vehicles if v.status == VehicleStatus.decommissioned]),
        }

        # Récupérer les inspections
        inspections = []
        if vehicle_ids:
            insp_result = await db.execute(
                select(Inspection)
                .where(Inspection.vehicle_id.in_(vehicle_ids))
                .order_by(Inspection.submitted_at.desc())
            )
            inspections = insp_result.scalars().all()

        total_inspections = len(inspections)

        first_day_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        inspections_this_month = len([i for i in inspections if i.submitted_at and i.submitted_at >= first_day_of_month])

        inspected_vehicle_ids = set(i.vehicle_id for i in inspections if i.vehicle_id)
        vehicles_never_inspected = len([v for v in vehicles if v.id not in inspected_vehicle_ids])

        thirty_days_ago = datetime.now() - timedelta(days=30)
        vehicles_with_recent_inspection = set()
        for i in inspections:
            if i.submitted_at and i.submitted_at >= thirty_days_ago:
                vehicles_with_recent_inspection.add(i.vehicle_id)
        vehicles_not_inspected_30_days = len([v for v in vehicles if v.id not in vehicles_with_recent_inspection])

        last_inspection = inspections[0] if inspections else None

        approved_inspections = len([i for i in inspections if i.manager_decision == ManagerDecision.approved])
        conformity_rate = round((approved_inspections / total_inspections * 100), 1) if total_inspections > 0 else 0

        return DashboardStatsOut(
            department_name=department_name,
            total_vehicles=total_vehicles,
            vehicles_by_status=vehicles_by_status,
            total_inspections=total_inspections,
            inspections_this_month=inspections_this_month,
            vehicles_never_inspected=vehicles_never_inspected,
            vehicles_not_inspected_30_days=vehicles_not_inspected_30_days,
            last_inspection_date=last_inspection.submitted_at if last_inspection else None,
            conformity_rate=conformity_rate,
        )

    except Exception as e:
        logger.error(f"[SUPERVISOR][DASHBOARD] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/vehicles", response_model=List[SupervisorVehicleOut])
async def get_supervisor_vehicles(
    status: Optional[str] = Query(None),
    needs_attention: Optional[bool] = Query(None),
    never_inspected: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.unit_supervisor, UserRole.admin))
):
    """Liste des véhicules du département"""
    try:
        # ✅ CORRECTION: Utiliser department_id
        if user.department_id:
            query = select(Vehicle).where(Vehicle.department_id == user.department_id)
        else:
            query = select(Vehicle).where(Vehicle.department.has(name=user.department))

        if status:
            try:
                status_enum = VehicleStatus(status)
                query = query.where(Vehicle.status == status_enum)
            except ValueError:
                pass

        query = query.limit(limit)
        result = await db.execute(query)
        vehicles = result.scalars().all()

        output = []
        for vehicle in vehicles:
            last_insp = await get_vehicle_last_inspection(db, vehicle.id)
            total_count = await get_vehicle_inspections_count(db, vehicle.id)

            days_since = None
            if last_insp and last_insp.submitted_at:
                delta = datetime.now() - last_insp.submitted_at
                days_since = delta.days

            last_agent_name = None
            last_manager_name = None
            if last_insp:
                if last_insp.agent_id:
                    agent_result = await db.execute(select(User).where(User.id == last_insp.agent_id))
                    agent = agent_result.scalar_one_or_none()
                    last_agent_name = agent.full_name if agent else None
                if last_insp.mission_id:
                    mission_result = await db.execute(select(Mission).where(Mission.id == last_insp.mission_id))
                    mission = mission_result.scalar_one_or_none()
                    if mission and mission.manager_id:
                        manager_result = await db.execute(select(User).where(User.id == mission.manager_id))
                        manager = manager_result.scalar_one_or_none()
                        last_manager_name = manager.full_name if manager else None

            needs_attention_flag = days_since is None or days_since > 30

            if needs_attention and not needs_attention_flag:
                continue
            if never_inspected and total_count > 0:
                continue

            output.append(SupervisorVehicleOut(
                id=vehicle.id,
                plate_number=vehicle.plate_number,
                brand=vehicle.brand,
                model=vehicle.model,
                year=vehicle.year,
                fuel_type=vehicle.fuel_type.value if hasattr(vehicle.fuel_type, 'value') else str(vehicle.fuel_type),
                current_mileage=vehicle.current_mileage,
                status=vehicle.status.value if hasattr(vehicle.status, 'value') else str(vehicle.status),
                last_inspection_date=last_insp.submitted_at if last_insp else None,
                last_inspection_conclusion=last_insp.agent_conclusion.value if last_insp and last_insp.agent_conclusion else None,
                last_manager_name=last_manager_name,
                last_agent_name=last_agent_name,
                total_inspections_count=total_count,
                days_since_last_inspection=days_since,
                needs_attention=needs_attention_flag,
            ))

        return output

    except Exception as e:
        logger.error(f"[SUPERVISOR][VEHICLES] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/inspections", response_model=List[SupervisorInspectionOut])
async def get_supervisor_inspections(
    vehicle_id: Optional[uuid.UUID] = Query(None),
    conclusion: Optional[str] = Query(None),
    decision: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.unit_supervisor, UserRole.admin))
):
    """Liste des inspections des véhicules du département"""
    try:
        # ✅ CORRECTION: Utiliser department_id
        if user.department_id:
            v_result = await db.execute(
                select(Vehicle).where(Vehicle.department_id == user.department_id)
            )
        else:
            v_result = await db.execute(
                select(Vehicle).where(Vehicle.department.has(name=user.department))
            )
        department_vehicles = v_result.scalars().all()
        vehicle_ids = [v.id for v in department_vehicles]
        vehicle_map = {v.id: {"plate": v.plate_number, "brand": v.brand, "model": v.model} for v in department_vehicles}

        if not vehicle_ids:
            return []

        query = select(Inspection).where(Inspection.vehicle_id.in_(vehicle_ids))

        if vehicle_id:
            query = query.where(Inspection.vehicle_id == vehicle_id)
        if conclusion:
            try:
                conclusion_enum = AgentConclusion(conclusion)
                query = query.where(Inspection.agent_conclusion == conclusion_enum)
            except ValueError:
                pass
        if decision:
            try:
                decision_enum = ManagerDecision(decision)
                query = query.where(Inspection.manager_decision == decision_enum)
            except ValueError:
                pass
        if from_date:
            query = query.where(Inspection.submitted_at >= from_date)
        if to_date:
            query = query.where(Inspection.submitted_at <= to_date)

        query = query.order_by(Inspection.submitted_at.desc()).offset(offset).limit(limit)

        result = await db.execute(query)
        inspections = result.scalars().all()

        output = []
        for insp in inspections:
            agent_name = None
            if insp.agent_id:
                agent_result = await db.execute(select(User).where(User.id == insp.agent_id))
                agent = agent_result.scalar_one_or_none()
                agent_name = agent.full_name if agent else None

            manager_name = None
            if insp.mission_id:
                mission_result = await db.execute(select(Mission).where(Mission.id == insp.mission_id))
                mission = mission_result.scalar_one_or_none()
                if mission and mission.manager_id:
                    manager_result = await db.execute(select(User).where(User.id == mission.manager_id))
                    manager = manager_result.scalar_one_or_none()
                    manager_name = manager.full_name if manager else None

            has_anomalies = False
            if insp.inspection_data:
                for item in insp.inspection_data.values():
                    if isinstance(item, dict) and item.get('status') in ['surveiller', 'non_conforme']:
                        has_anomalies = True
                        break

            vehicle_info = vehicle_map.get(insp.vehicle_id, {"plate": "N/A", "brand": "", "model": ""})

            if search:
                search_lower = search.lower()
                if not (search_lower in vehicle_info.get('plate', '').lower() or
                       (agent_name and search_lower in agent_name.lower()) or
                       (manager_name and search_lower in manager_name.lower())):
                    continue

            output.append(SupervisorInspectionOut(
                id=insp.id,
                vehicle_plate=vehicle_info.get('plate'),
                vehicle_brand=vehicle_info.get('brand'),
                vehicle_model=vehicle_info.get('model'),
                agent_name=agent_name,
                manager_name=manager_name,
                agent_conclusion=insp.agent_conclusion.value if insp.agent_conclusion else "fit",
                manager_decision=insp.manager_decision.value if insp.manager_decision else "pending",
                mileage_at_inspection=insp.mileage_at_inspection,
                submitted_at=insp.submitted_at,
                decided_at=insp.decided_at,
                has_anomalies=has_anomalies,
                observations=insp.observations,
                inspection_data=insp.inspection_data,
            ))

        return output

    except Exception as e:
        logger.error(f"[SUPERVISOR][INSPECTIONS] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.post("/notify-agent", response_model=NotifyAgentOut)
async def notify_agent(
    body: NotifyAgentBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.unit_supervisor, UserRole.admin))
):
    """Envoie une notification à un agent du département"""
    try:
        # Vérifier l'agent
        agent_result = await db.execute(select(User).where(User.id == body.agent_id))
        agent = agent_result.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent non trouvé")

        if agent.role != UserRole.agent:
            raise HTTPException(status_code=400, detail="L'utilisateur sélectionné n'est pas un agent")

        # Vérifier que l'agent est dans le même département
        if agent.department != user.department:
            if agent.department_id != user.department_id:
                raise HTTPException(status_code=403, detail="Cet agent n'appartient pas à votre département")

        # Vérifier le véhicule
        if user.department_id:
            vehicle_result = await db.execute(
                select(Vehicle).where(Vehicle.id == body.vehicle_id, Vehicle.department_id == user.department_id)
            )
        else:
            vehicle_result = await db.execute(
                select(Vehicle).where(Vehicle.id == body.vehicle_id, Vehicle.department.has(name=user.department))
            )
        vehicle = vehicle_result.scalar_one_or_none()
        if not vehicle:
            raise HTTPException(status_code=404, detail="Véhicule non trouvé ou n'appartient pas à votre département")

        notification_message = body.message or f"Veuillez effectuer l'inspection du véhicule {vehicle.plate_number}"

        # Création de la mission d'inspection (Notification)
        new_mission = Mission(
            agent_id=agent.id,
            vehicle_id=vehicle.id,
            manager_id=user.id,
            mission_date=datetime.utcnow().date(),
            destination="Inspection assignée (Superviseur)",
            purpose=notification_message,
            department=user.department,
            status=MissionStatus.VEHICULE_ATTRIBUE
        )
        db.add(new_mission)
        await db.commit()

        logger.info(f"[SUPERVISOR] Notification envoyée à {agent.full_name} pour le véhicule {vehicle.plate_number} par {user.full_name} (Mission {new_mission.id})")

        return NotifyAgentOut(
            success=True,
            notified_agent=agent.full_name,
            message=notification_message
        )

    except HTTPException:
        raise
        logger.error(f"[SUPERVISOR][NOTIFY] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/agents", response_model=List[SupervisorAgentOut])
async def get_supervisor_agents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.unit_supervisor, UserRole.admin))
):
    """Liste des agents appartenant au même département que le superviseur"""
    try:
        query = select(User).where(
            User.role == UserRole.agent,
            User.is_active == True
        )
        
        # Filtre par département : on utilise department_id ou department
        conditions = []
        if user.department_id:
            conditions.append(User.department_id == user.department_id)
        if user.department:
            conditions.append(User.department == user.department)
            
        if conditions:
            query = query.where(or_(*conditions))
        else:
            # Si le superviseur n'a aucun département assigné, on ne retourne rien (ou tout, selon la politique)
            # Pour la sécurité, il vaut mieux ne rien retourner s'il n'a pas de département défini
            return []
            
        result = await db.execute(query.order_by(User.full_name))
        agents = result.scalars().all()
        
        output = [
            SupervisorAgentOut(
                id=agent.id,
                full_name=agent.full_name,
                email=agent.email
            )
            for agent in agents
        ]
            
        return output

    except Exception as e:
        logger.error(f"[SUPERVISOR][AGENTS] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")