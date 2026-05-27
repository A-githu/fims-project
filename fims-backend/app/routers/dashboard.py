import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.mission import Mission, MissionStatus
from app.models.inspection import Inspection, ManagerDecision, AgentConclusion
from app.models.maintenance import MaintenanceTask, MaintenanceStatus
from app.models.user import UserRole
from app.core.dependencies import require_role

logger = logging.getLogger("fims")
router = APIRouter(prefix="/api/dashboard", tags=["Dashboard - Tableau de Bord"])


@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    """Indicateurs clés du tableau de bord pour le Manager"""
    try:
        # Véhicules
        v_total = (await db.execute(select(func.count(Vehicle.id)))).scalar() or 0
        v_active = (await db.execute(select(func.count(Vehicle.id)).where(Vehicle.status == VehicleStatus.active))).scalar() or 0
        v_maint = (await db.execute(select(func.count(Vehicle.id)).where(Vehicle.status == VehicleStatus.maintenance))).scalar() or 0
        v_blocked = (await db.execute(select(func.count(Vehicle.id)).where(Vehicle.status == VehicleStatus.blocked))).scalar() or 0
        v_in_mission = (await db.execute(select(func.count(Vehicle.id)).where(Vehicle.status == VehicleStatus.in_mission))).scalar() or 0
        v_decomm = (await db.execute(select(func.count(Vehicle.id)).where(Vehicle.status == VehicleStatus.decommissioned))).scalar() or 0

        # Missions
        m_attente = (await db.execute(select(func.count(Mission.id)).where(Mission.status == MissionStatus.EN_ATTENTE_ATTRIBUTION))).scalar() or 0
        m_attribue = (await db.execute(select(func.count(Mission.id)).where(Mission.status == MissionStatus.VEHICULE_ATTRIBUE))).scalar() or 0
        m_soumise = (await db.execute(select(func.count(Mission.id)).where(Mission.status == MissionStatus.INSPECTION_SOUMISE))).scalar() or 0
        m_approuvee = (await db.execute(select(func.count(Mission.id)).where(Mission.status == MissionStatus.APPROUVEE))).scalar() or 0
        m_terminee = (await db.execute(select(func.count(Mission.id)).where(Mission.status == MissionStatus.TERMINEE))).scalar() or 0
        m_rejetee = (await db.execute(select(func.count(Mission.id)).where(Mission.status == MissionStatus.REJETEE))).scalar() or 0
        m_nouveau = (await db.execute(select(func.count(Mission.id)).where(Mission.status == MissionStatus.NOUVEAU_VEHICULE_REQUIS))).scalar() or 0

        # Inspections
        i_pending = (await db.execute(select(func.count(Inspection.id)).where(Inspection.manager_decision == ManagerDecision.pending))).scalar() or 0
        i_approved = (await db.execute(select(func.count(Inspection.id)).where(Inspection.manager_decision == ManagerDecision.approved))).scalar() or 0
        i_rejected = (await db.execute(select(func.count(Inspection.id)).where(Inspection.manager_decision == ManagerDecision.rejected))).scalar() or 0
        i_fit = (await db.execute(select(func.count(Inspection.id)).where(Inspection.agent_conclusion == AgentConclusion.fit))).scalar() or 0
        i_warning = (await db.execute(select(func.count(Inspection.id)).where(Inspection.agent_conclusion == AgentConclusion.warning))).scalar() or 0
        i_unfit = (await db.execute(select(func.count(Inspection.id)).where(Inspection.agent_conclusion == AgentConclusion.unfit))).scalar() or 0

        # Maintenance
        mt_pending = (await db.execute(select(func.count(MaintenanceTask.id)).where(MaintenanceTask.status == MaintenanceStatus.pending))).scalar() or 0
        mt_progress = (await db.execute(select(func.count(MaintenanceTask.id)).where(MaintenanceTask.status == MaintenanceStatus.in_progress))).scalar() or 0
        mt_done = (await db.execute(select(func.count(MaintenanceTask.id)).where(MaintenanceTask.status == MaintenanceStatus.done))).scalar() or 0

        taux = round((v_active / v_total * 100), 1) if v_total else 0

        return {
            "parc_vehicules": {
                "total": v_total,
                "actifs": v_active,
                "en_mission": v_in_mission,
                "en_maintenance": v_maint,
                "bloques": v_blocked,
                "hors_service": v_decomm,
                "taux_disponibilite": f"{taux}%",
            },
            "missions": {
                "en_attente_attribution": m_attente,
                "vehicule_attribue": m_attribue,
                "inspection_soumise": m_soumise,
                "approuvees": m_approuvee,
                "terminees": m_terminee,
                "rejetees": m_rejetee,
                "nouveau_vehicule_requis": m_nouveau,
            },
            "inspections": {
                "en_attente_decision_manager": i_pending,
                "approuvees": i_approved,
                "rejetees": i_rejected,
                "conclusions": {"aptes": i_fit, "avec_reserves": i_warning, "inaptes": i_unfit},
            },
            "maintenance": {
                "en_attente": mt_pending,
                "en_cours": mt_progress,
                "terminees": mt_done,
            },
            "alertes": {
                "missions_sans_vehicule": m_attente + m_nouveau,
                "inspections_sans_decision": i_pending,
                "vehicules_bloques": v_blocked,
                "taches_maintenance_urgentes": mt_pending,
            },
        }
    except Exception as e:
        logger.error(f"[DASHBOARD] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/pending-missions")
async def get_pending_missions_for_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    """Liste des missions en attente pour le widget du dashboard"""
    try:
        result = await db.execute(
            select(Mission)
            .where(Mission.status.in_([MissionStatus.EN_ATTENTE_ATTRIBUTION, MissionStatus.NOUVEAU_VEHICULE_REQUIS]))
            .order_by(Mission.created_at.asc())
            .limit(10)
        )
        missions = result.scalars().all()
        
        output = []
        for mission in missions:
            agent_name = None
            if mission.agent_id:
                agent_result = await db.execute(select(User).where(User.id == mission.agent_id))
                agent = agent_result.scalar_one_or_none()
                agent_name = agent.full_name if agent else None
            
            output.append({
                "id": str(mission.id),
                "destination": mission.destination,
                "agent_name": agent_name,
                "created_at": mission.created_at.isoformat() if mission.created_at else None,
                "status": mission.status.value
            })
        
        return output
    except Exception as e:
        logger.error(f"[DASHBOARD][PENDING_MISSIONS] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/pending-inspections")
async def get_pending_inspections_for_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(UserRole.manager, UserRole.admin))
):
    """Liste des inspections en attente pour le widget du dashboard"""
    try:
        result = await db.execute(
            select(Inspection)
            .where(Inspection.manager_decision == ManagerDecision.pending)
            .order_by(Inspection.submitted_at.asc())
            .limit(10)
        )
        inspections = result.scalars().all()
        
        output = []
        for insp in inspections:
            agent_name = None
            vehicle_plate = None
            
            if insp.agent_id:
                agent_result = await db.execute(select(User).where(User.id == insp.agent_id))
                agent = agent_result.scalar_one_or_none()
                agent_name = agent.full_name if agent else None
            
            if insp.vehicle_id:
                vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == insp.vehicle_id))
                vehicle = vehicle_result.scalar_one_or_none()
                vehicle_plate = vehicle.plate_number if vehicle else None
            
            output.append({
                "id": str(insp.id),
                "vehicle_plate": vehicle_plate,
                "agent_name": agent_name,
                "submitted_at": insp.submitted_at.isoformat() if insp.submitted_at else None,
                "agent_conclusion": insp.agent_conclusion.value
            })
        
        return output
    except Exception as e:
        logger.error(f"[DASHBOARD][PENDING_INSPECTIONS] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")