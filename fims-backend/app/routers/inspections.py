import logging
import uuid
import io
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field, field_validator

from app.database import get_db
from app.models.inspection import Inspection, AgentConclusion, ManagerDecision
from app.models.mission import Mission, MissionStatus
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.user import User, UserRole
from app.models.maintenance import MaintenanceTask
from app.core.dependencies import get_current_user, require_role

logger = logging.getLogger("fims")
router = APIRouter(prefix="/api/inspections", tags=["Inspections - Check-Up ENEO"])


# ============================================================================
# SCHEMAS PYDANTIC - conformes à la fiche ENEO
# ============================================================================

class CheckItem(BaseModel):
    status: str = Field(
        ...,
        pattern="^(conforme|surveiller|non_conforme)$",
        description="Valeurs acceptées : conforme | surveiller | non_conforme"
    )
    comment: Optional[str] = Field(None, max_length=200, description="Commentaire sur l'état du point")


class InspectionData(BaseModel):
    """Grille complète conforme à la fiche ENEO"""
    # EXTÉRIEUR (Section B - Outside the vehicle)
    pneumatiques: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    eclairages: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    retroviseurs: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    carrosserie: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    
    # INTÉRIEUR (Section B - Inside the vehicle)
    ceintures: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    commande_retroviseurs: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"), description="Commande des rétroviseurs")
    commande_essuie_glaces: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"), description="Commande essuie-glaces")
    volant: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    eclairage_interne: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"), description="Éclairage interne")
    klaxon: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"), description="Avertisseur sonore")
    tableau_bord: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"), description="Tableau de bord / Voyants")
    fonctionnement_freins: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"), description="Fonctionnement des freins")
    demarrage: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    confort: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"), description="Confort (tapisserie, climatisation, CD)")
    
    # SOUS LE CAPOT (Sous le capot / Under the hood)
    niveau_huile: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    batterie: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    etat_moteur: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"), description="État général du moteur")
    liquide_refroidissement: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    
    # KIT CONDUCTEUR (Driver kit)
    triangle_presignalisation: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    gilet_reflechissant: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    EXTINCTEUR: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"))
    cric_cle_roue: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"), description="Cric et clé de roue")
    roue_secours: CheckItem = Field(default_factory=lambda: CheckItem(status="conforme"), description="Roue de secours en état")


class InspectionCreate(BaseModel):
    mission_id: uuid.UUID = Field(..., description="UUID de la mission en statut VEHICULE_ATTRIBUE")
    mileage_at_inspection: int = Field(..., ge=0, le=9999999, example=45320, description="Kilométrage au moment du contrôle (Checkup mileage)")
    inspection_data: InspectionData = Field(..., description="Grille complète des points de contrôle")
    observations: Optional[str] = Field(None, max_length=2000, description="Observations sur les non-conformités")
    agent_conclusion: AgentConclusion = Field(
        ...,
        description="""
        Conclusion de l'agent selon fiche ENEO:
        - fit: ✓ Le véhicule peut être utilisé en sécurité
        - warning: ⚠ Utilisable avec réserves
        - unfit: ✗ Le véhicule ne doit pas être utilisé
        """
    )
    photos: Optional[List[str]] = Field(default=[], description="URLs des photos (optionnel)")
    
    @field_validator("mileage_at_inspection")
    def validate_mileage(cls, v):
        if v < 0:
            raise ValueError("Le kilométrage ne peut pas être négatif")
        return v


class InspectionManagerAction(BaseModel):
    comment: Optional[str] = Field(None, max_length=500, description="Commentaire du Manager (optionnel)")


class InspectionOut(BaseModel):
    id: uuid.UUID
    mission_id: uuid.UUID
    vehicle_id: uuid.UUID
    agent_id: uuid.UUID
    mileage_at_inspection: int
    inspection_data: Dict[str, Any]
    observations: Optional[str]
    agent_conclusion: AgentConclusion
    photos: List[Any]
    manager_decision: ManagerDecision
    manager_comment: Optional[str]
    submitted_at: Optional[datetime]
    decided_at: Optional[datetime]
    agent: Optional[Dict] = None
    vehicle: Optional[Dict] = None
    mission: Optional[Dict] = None
    
    class Config:
        from_attributes = True


class InspectionSummaryOut(BaseModel):
    """Version simplifiée pour les listes"""
    id: uuid.UUID
    mission_id: uuid.UUID
    vehicle_plate: Optional[str]
    agent_name: Optional[str]
    mileage_at_inspection: int
    agent_conclusion: str
    manager_decision: str
    submitted_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# ============================================================================
# HELPERS - Génération PDF conforme ENEO
# ============================================================================

def _get_status_text(status: str) -> str:
    return {
        "conforme": "OK",
        "surveiller": "A surveiller",
        "non_conforme": "NON CONFORME"
    }.get(status, status)


def _get_status_class(status: str) -> str:
    return {
        "conforme": "status-ok",
        "surveiller": "status-warning",
        "non_conforme": "status-nok"
    }.get(status, "")


def _get_conclusion_text(conclusion: AgentConclusion) -> tuple[str, str]:
    texts = {
        "fit": ("✓ Le véhicule peut être utilisé en sécurité", "fit"),
        "warning": ("⚠ Le véhicule utilisable avec réserves", "warning"),
        "unfit": ("✗ Le véhicule ne doit pas être utilisé compte tenu des non-conformités constatées", "unfit")
    }
    return texts.get(conclusion.value, ("État inconnu", "unknown"))


def _get_decision_text(decision: ManagerDecision) -> str:
    return {
        "approved": "✓ VALIDÉE - Mise en circulation autorisée",
        "rejected": "✗ REJETÉE - Véhicule non conforme",
        "pending": "⏳ EN ATTENTE DE VALIDATION"
    }.get(decision.value, "État inconnu")


def _get_french_status(status: str) -> str:
    return {
        "conforme": "Bon état",
        "surveiller": "À surveiller",
        "non_conforme": "Défectueux"
    }.get(status, status)


def _build_pdf_html(inspection: Inspection, vehicle, agent, mission) -> str:
    idata = inspection.inspection_data or {}
    
    v_info = f"{vehicle.brand} {vehicle.model}" if vehicle else "N/A"
    plate = vehicle.plate_number if vehicle else "N/A"
    region = mission.destination.split(" — ")[0] if mission and " — " in mission.destination else (mission.destination if mission else "N/A")
    user_unit = mission.department or (mission.purpose[:50] if mission else "N/A")
    date_insp = inspection.submitted_at.strftime("%d/%m/%Y à %H:%M") if inspection.submitted_at else "N/A"
    mileage = f"{inspection.mileage_at_inspection:,}".replace(",", " ") if inspection.mileage_at_inspection else "N/A"
    
    inspection_sections = [
        ("A l'extérieur du véhicule / Outside the vehicle", [
            ("Pneumatiques", "pneumatiques"),
            ("Éclairages (phares, feux)", "eclairages"),
            ("Rétroviseurs", "retroviseurs"),
            ("Carrosserie (chocs, rayures)", "carrosserie"),
        ]),
        ("A l'intérieur du véhicule / Inside the vehicle", [
            ("Ceintures de sécurité", "ceintures"),
            ("Commande des rétroviseurs", "commande_retroviseurs"),
            ("Commande essuie-glaces", "commande_essuie_glaces"),
            ("Volant", "volant"),
            ("Éclairage interne", "eclairage_interne"),
            ("Avertisseur sonore (Klaxon)", "klaxon"),
            ("Tableau de bord / Voyants", "tableau_bord"),
            ("Fonctionnement des freins", "fonctionnement_freins"),
            ("Démarrage", "demarrage"),
            ("Confort (tapisserie, climatisation, CD)", "confort"),
        ]),
        ("Sous le capot / Under the hood", [
            ("Niveau d'huile", "niveau_huile"),
            ("Batterie", "batterie"),
            ("État général du moteur", "etat_moteur"),
            ("Liquide de refroidissement", "liquide_refroidissement"),
        ]),
        ("Kit Conducteur / Driver kit", [
            ("Triangle de présignalisation", "triangle_presignalisation"),
            ("Gilet réfléchissant", "gilet_reflechissant"),
            ("Extincteur", "EXTINCTEUR"),
            ("Cric et clé de roue", "cric_cle_roue"),
            ("Roue de secours", "roue_secours"),
        ]),
    ]
    
    table_rows = ""
    for section_title, items in inspection_sections:
        table_rows += f'<tr class="section-header"><td colspan="4"><strong>{section_title}</strong></td></tr>'
        for label, key in items:
            item = idata.get(key, {})
            status = item.get("status", "conforme") if isinstance(item, dict) else "conforme"
            comment = item.get("comment", "") if isinstance(item, dict) else ""
            status_french = _get_french_status(status)
            status_class = _get_status_class(status)
            
            checkbox_ok = "☒" if status == "conforme" else "☐"
            checkbox_surv = "☒" if status == "surveiller" else "☐"
            checkbox_nok = "☒" if status == "non_conforme" else "☐"
            
            table_rows += f'''
            <tr>
                <td class="check-label">{label}</td>
                <td class="check-checkboxes">
                    {checkbox_ok} OK &nbsp;&nbsp;
                    {checkbox_surv} À surveiller &nbsp;&nbsp;
                    {checkbox_nok} Non conforme
                </td>
                <td class="check-status {status_class}">{status_french}</td>
                <td class="check-comment">{comment}</td>
            </tr>
            '''
    
    observations = inspection.observations or "Aucune observation particulière"
    observations_lines = [obs.strip() for obs in observations.split('\n') if obs.strip()]
    observations_html = ""
    for i, obs in enumerate(observations_lines[:6], 1):
        observations_html += f"<tr><td style=\"width:30px; text-align:center;\">{i}</td><td>{obs}</td></tr>"
    if not observations_html:
        observations_html = "<tr><td style=\"width:30px; text-align:center;\">1</td><td>Aucune anomalie détectée</td></tr>"
    
    conclusion_text, conclusion_class = _get_conclusion_text(inspection.agent_conclusion)
    decision_text = _get_decision_text(inspection.manager_decision)
    decision_class = "approved" if inspection.manager_decision == ManagerDecision.approved else ("rejected" if inspection.manager_decision == ManagerDecision.rejected else "pending")
    
    agent_name = agent.full_name if agent else "___________"
    agent_matricule = getattr(agent, 'employee_id', '___________') if agent else "___________"
    
    html = f'''
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>FICHE DE CHECK-UP DU VÉHICULE - {plate}</title>
        <style>
            @media print {{
                body {{ margin: 0; padding: 0; }}
                .no-print {{ display: none; }}
            }}
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Arial', 'Helvetica', sans-serif;
                font-size: 11px;
                line-height: 1.4;
                color: #000;
                background: #fff;
                padding: 15px;
            }}
            .container {{
                max-width: 1100px;
                margin: 0 auto;
                border: 1px solid #333;
            }}
            .header {{
                padding: 12px;
                border-bottom: 2px solid #333;
                background: #f0f7f0;
            }}
            .header h1 {{
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 5px;
                color: #1a4d1a;
            }}
            .header .ref {{
                font-size: 9px;
                color: #555;
                margin-top: 3px;
            }}
            .info-section {{
                padding: 12px;
                border-bottom: 1px solid #333;
            }}
            .inspection-table {{
                width: 100%;
                border-collapse: collapse;
                margin: 8px 0;
                font-size: 10px;
            }}
            .inspection-table th,
            .inspection-table td {{
                border: 1px solid #000;
                padding: 6px;
                vertical-align: top;
            }}
            .inspection-table th {{
                background: #e0e0e0;
                font-weight: bold;
                text-align: center;
            }}
            .section-header td {{
                background: #d0e8d0;
                font-weight: bold;
            }}
            .check-label {{
                width: 30%;
                font-weight: 500;
            }}
            .check-checkboxes {{
                width: 30%;
                white-space: nowrap;
            }}
            .check-status {{
                width: 15%;
                text-align: center;
                font-weight: bold;
            }}
            .check-comment {{
                width: 25%;
                font-size: 9px;
            }}
            .status-ok {{ background: #d4edda; color: #155724; }}
            .status-warning {{ background: #fff3cd; color: #856404; }}
            .status-nok {{ background: #f8d7da; color: #721c24; }}
            .observations-table {{
                width: 100%;
                border-collapse: collapse;
                margin: 8px 0;
            }}
            .observations-table th,
            .observations-table td {{
                border: 1px solid #000;
                padding: 5px;
                font-size: 9px;
                vertical-align: top;
            }}
            .observations-table th {{
                background: #e0e0e0;
                width: 30px;
            }}
            .conclusion {{
                margin: 10px 12px;
                padding: 10px;
                border: 1px solid #000;
            }}
            .conclusion-options {{
                margin: 10px 0;
            }}
            .conclusion-option {{
                margin: 6px 0;
                padding: 6px 10px;
                border-radius: 4px;
            }}
            .conclusion-option.fit {{ background: #d4edda; }}
            .conclusion-option.warning {{ background: #fff3cd; }}
            .conclusion-option.unfit {{ background: #f8d7da; }}
            .conclusion-option.approved {{ background: #d4edda; }}
            .conclusion-option.rejected {{ background: #f8d7da; }}
            .conclusion-option.pending {{ background: #e0e0e0; }}
            .checkbox {{
                display: inline-block;
                font-family: monospace;
                font-size: 12px;
            }}
            .signature {{
                margin: 10px 12px;
                padding: 10px;
                border: 1px solid #000;
            }}
            .signature-line {{
                margin-top: 15px;
                padding-top: 8px;
                border-top: 1px dashed #999;
            }}
            .footer {{
                margin-top: 15px;
                padding: 8px;
                text-align: center;
                font-size: 8px;
                border-top: 1px solid #333;
                background: #f5f5f5;
            }}
            .print-button {{
                text-align: center;
                margin: 20px 0;
            }}
            .print-button button {{
                padding: 10px 20px;
                font-size: 12px;
                background: #1a4d1a;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }}
        </style>
    </head>
    <body>
        <div class="print-button no-print">
            <button onclick="window.print();">🖨️ Imprimer / Sauvegarder en PDF</button>
            <p style="font-size: 10px; margin-top: 5px;">Astuce: Ctrl+P puis "Enregistrer au format PDF"</p>
        </div>
        
        <div class="container">
            <div class="header">
                <h1>FICHE DE CHECK-UP DU VÉHICULE<br>VEHICLE CHECK-UP FORM</h1>
                <div class="ref">EO FO QHSE QAC 001 FE-A</div>
                <div class="ref">Document notifié: EO MA DASE P 041 F8</div>
                <div class="ref">Admetté d'instructions relatives à la conduite défensive et sécurité des véhicules</div>
            </div>
            
            <div class="info-section">
                <table style="width:100%; border-collapse: collapse;">
                    <tr>
                        <td style="width:33%; padding:4px;"><strong>Date du contrôle / Check-up date</strong><br>{date_insp}</td>
                        <td style="width:33%; padding:4px;"><strong>Immatriculation véhicule / Vehicle registration</strong><br>{plate}</td>
                        <td style="width:34%; padding:4px;"><strong>Marque / Mark</strong><br>{v_info}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px;"><strong>Modèle / Model</strong><br>{vehicle.model if vehicle else "N/A"}</td>
                        <td style="padding:4px;"><strong>Région / Region</strong><br>{region}</td>
                        <td style="padding:4px;"><strong>Unité utilisatrice / User unit</strong><br>{user_unit}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px;"><strong>Kilométrage au moment du contrôle / Checkup mileage</strong><br>{mileage} km</td>
                        <td style="padding:4px;"><strong>Agent / Driver</strong><br>{agent_name}</td>
                        <td style="padding:4px;"><strong>Matricule / Employee ID</strong><br>{agent_matricule}</td>
                    </tr>
                </table>
            </div>
            
            <div class="info-section">
                <table class="inspection-table">
                    <thead>
                        <tr>
                            <th>Point de contrôle</th>
                            <th>État constaté</th>
                            <th>Statut</th>
                            <th>Observations</th>
                        </tr>
                    </thead>
                    <tbody>
                        {table_rows}
                    </tbody>
                </table>
            </div>
            
            <div class="info-section">
                <strong>Observations sur les non conformités / Observations on findings</strong>
                <table class="observations-table">
                    <thead><tr><th>#</th><th>Observations</th></tr></thead>
                    <tbody>{observations_html}</tbody>
                </table>
            </div>
            
            <div class="conclusion">
                <strong>Cochez la bonne mention / Select the correct entry</strong>
                <div class="conclusion-options">
                    <div class="conclusion-option {conclusion_class}">
                        <span class="checkbox">{'☒' if inspection.agent_conclusion.value == 'fit' else '☐'}</span>
                        ✓ Le véhicule peut être utilisé en sécurité / Car can be used safely
                    </div>
                    <div class="conclusion-option warning">
                        <span class="checkbox">{'☒' if inspection.agent_conclusion.value == 'warning' else '☐'}</span>
                        ⚠ Le véhicule utilisable avec réserves / Car can be used with restrictions
                    </div>
                    <div class="conclusion-option unfit">
                        <span class="checkbox">{'☒' if inspection.agent_conclusion.value == 'unfit' else '☐'}</span>
                        ✗ Le véhicule ne doit pas être utilisé compte tenu des non-conformités constatées / The car must not be used given the findings noted
                    </div>
                </div>
            </div>
            
            <div class="conclusion" style="margin-top:0;">
                <strong>Décision du Manager / Manager Decision</strong>
                <div class="conclusion-option {decision_class}" style="margin-top:8px;">
                    {decision_text}
                </div>
                {f'<div style="margin-top:8px;"><strong>Commentaire:</strong> {inspection.manager_comment}</div>' if inspection.manager_comment else ''}
                {f'<div style="margin-top:4px; font-size:9px; color:#666;">Décidé le: {inspection.decided_at.strftime("%d/%m/%Y à %H:%M") if inspection.decided_at else "Non décidé"}</div>' if inspection.manager_decision != ManagerDecision.pending else ''}
            </div>
            
            <div class="signature">
                <strong>Je soussigné M./Mme./Mlle.</strong>
                <div style="margin-top: 12px; padding: 5px; border-bottom: 1px solid #000; width: 60%;">{agent_name}</div>
                <div class="signature-line"><em>Safe drive to preserve our lives and asset</em></div>
            </div>
            
            <div class="footer">
                Document généré automatiquement par FIMS - Fleet Inspection Management System v1.0
                <br>ENEO - Direction Logistique | {datetime.utcnow().strftime("%d/%m/%Y à %H:%M")} UTC
            </div>
        </div>
    </body>
    </html>
    '''
    
    return html


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/", response_model=InspectionOut, status_code=201)
async def submit_inspection(
    body: InspectionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.agent, UserRole.manager, UserRole.admin))
):
    try:
        m_result = await db.execute(select(Mission).where(Mission.id == body.mission_id))
        mission = m_result.scalar_one_or_none()
        if not mission:
            raise HTTPException(status_code=404, detail=f"Mission {body.mission_id} introuvable.")
        
        if mission.status != MissionStatus.VEHICULE_ATTRIBUE:
            raise HTTPException(
                status_code=400,
                detail=f"Impossible de soumettre une inspection : la mission est en statut '{mission.status.value}'. Elle doit être en 'VEHICULE_ATTRIBUE'."
            )
        
        if user.role == UserRole.agent and mission.agent_id != user.id:
            raise HTTPException(status_code=403, detail="Vous ne pouvez inspecter que vos propres missions.")
        
        if mission.vehicle_id:
            v_result = await db.execute(select(Vehicle).where(Vehicle.id == mission.vehicle_id))
            vehicle_check = v_result.scalar_one_or_none()
            if vehicle_check and body.mileage_at_inspection < vehicle_check.current_mileage:
                raise HTTPException(
                    status_code=400,
                    detail=f"Le kilométrage saisi ({body.mileage_at_inspection}) est inférieur au dernier relevé ({vehicle_check.current_mileage})."
                )
        
        inspection = Inspection(
            mission_id=body.mission_id,
            vehicle_id=mission.vehicle_id,
            agent_id=user.id,
            mileage_at_inspection=body.mileage_at_inspection,
            inspection_data=body.inspection_data.model_dump(),
            observations=body.observations,
            agent_conclusion=body.agent_conclusion,
            photos=body.photos or [],
        )
        
        # Auto-approbation si l'inspection est conforme (Fit)
        if body.agent_conclusion == AgentConclusion.fit:
            inspection.manager_decision = ManagerDecision.approved
            inspection.decided_at = datetime.utcnow()
            inspection.manager_comment = "Auto-approuvé (Véhicule conforme)"
            mission.status = MissionStatus.APPROUVEE
        else:
            mission.status = MissionStatus.INSPECTION_SOUMISE
            
        db.add(inspection)
        
        if mission.vehicle_id:
            await db.execute(
                update(Vehicle).where(Vehicle.id == mission.vehicle_id)
                .values(current_mileage=body.mileage_at_inspection)
            )
        
        if body.agent_conclusion == AgentConclusion.unfit:
            task = MaintenanceTask(
                vehicle_id=mission.vehicle_id,
                created_by=user.id,
                title=f"Maintenance requise - {datetime.utcnow().strftime('%d/%m/%Y')}",
                description=f"Véhicule déclaré inapte lors de l'inspection.\nObservations: {body.observations or 'Aucune'}\nPoints défaillants: {', '.join([k for k, v in body.inspection_data.model_dump().items() if v.get('status') == 'non_conforme'])}",
            )
            db.add(task)
            logger.info(f"[INSPECTION] Tâche maintenance auto-créée pour véhicule {mission.vehicle_id}")
        
        await db.commit()
        await db.refresh(inspection)
        
        logger.info(f"[INSPECTION] Soumise par {user.email} - conclusion: {body.agent_conclusion.value}")
        
        agent_info = {"id": str(user.id), "full_name": user.full_name}
        vehicle_info = None
        if mission.vehicle_id and vehicle_check:
            vehicle_info = {
                "id": str(mission.vehicle_id),
                "plate_number": vehicle_check.plate_number,
                "brand": vehicle_check.brand,
                "model": vehicle_check.model
            }
        
        return {
            "id": inspection.id,
            "mission_id": inspection.mission_id,
            "vehicle_id": inspection.vehicle_id,
            "agent_id": inspection.agent_id,
            "mileage_at_inspection": inspection.mileage_at_inspection,
            "inspection_data": inspection.inspection_data,
            "observations": inspection.observations,
            "agent_conclusion": inspection.agent_conclusion,
            "photos": inspection.photos,
            "manager_decision": inspection.manager_decision,
            "manager_comment": inspection.manager_comment,
            "submitted_at": inspection.submitted_at,
            "decided_at": inspection.decided_at,
            "agent": agent_info,
            "vehicle": vehicle_info,
            "mission": {"id": str(mission.id), "destination": mission.destination}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[INSPECTIONS][CREATE] {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/", response_model=List[InspectionOut])
async def list_inspections(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        query = select(Inspection).order_by(Inspection.submitted_at.desc())
        if user.role == UserRole.agent:
            query = query.where(Inspection.agent_id == user.id)
        
        result = await db.execute(query)
        inspections = result.scalars().all()
        
        output = []
        for insp in inspections:
            agent_info = None
            if insp.agent_id:
                agent_result = await db.execute(select(User).where(User.id == insp.agent_id))
                agent = agent_result.scalar_one_or_none()
                if agent:
                    agent_info = {"id": str(agent.id), "full_name": agent.full_name}
            
            vehicle_info = None
            if insp.vehicle_id:
                vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == insp.vehicle_id))
                vehicle = vehicle_result.scalar_one_or_none()
                if vehicle:
                    vehicle_info = {
                        "id": str(vehicle.id),
                        "plate_number": vehicle.plate_number,
                        "brand": vehicle.brand,
                        "model": vehicle.model
                    }
            
            mission_info = None
            if insp.mission_id:
                mission_result = await db.execute(select(Mission).where(Mission.id == insp.mission_id))
                mission = mission_result.scalar_one_or_none()
                if mission:
                    mission_info = {"id": str(mission.id), "destination": mission.destination}
            
            output.append({
                "id": insp.id,
                "mission_id": insp.mission_id,
                "vehicle_id": insp.vehicle_id,
                "agent_id": insp.agent_id,
                "mileage_at_inspection": insp.mileage_at_inspection,
                "inspection_data": insp.inspection_data or {},
                "observations": insp.observations,
                "agent_conclusion": insp.agent_conclusion,
                "photos": insp.photos or [],
                "manager_decision": insp.manager_decision,
                "manager_comment": insp.manager_comment,
                "submitted_at": insp.submitted_at,
                "decided_at": insp.decided_at,
                "agent": agent_info,
                "vehicle": vehicle_info,
                "mission": mission_info,
            })
        
        return output
        
    except Exception as e:
        logger.error(f"[INSPECTIONS][LIST] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/pending", response_model=List[InspectionOut])
async def list_pending_inspections(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.manager, UserRole.admin))
):
    try:
        result = await db.execute(
            select(Inspection).where(Inspection.manager_decision == ManagerDecision.pending)
            .order_by(Inspection.submitted_at.asc())
        )
        inspections = result.scalars().all()
        
        output = []
        for insp in inspections:
            agent_info = None
            if insp.agent_id:
                agent_result = await db.execute(select(User).where(User.id == insp.agent_id))
                agent = agent_result.scalar_one_or_none()
                if agent:
                    agent_info = {"id": str(agent.id), "full_name": agent.full_name}
            
            vehicle_info = None
            if insp.vehicle_id:
                vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == insp.vehicle_id))
                vehicle = vehicle_result.scalar_one_or_none()
                if vehicle:
                    vehicle_info = {
                        "id": str(vehicle.id),
                        "plate_number": vehicle.plate_number,
                        "brand": vehicle.brand,
                        "model": vehicle.model
                    }
            
            output.append({
                "id": insp.id,
                "mission_id": insp.mission_id,
                "vehicle_id": insp.vehicle_id,
                "agent_id": insp.agent_id,
                "mileage_at_inspection": insp.mileage_at_inspection,
                "inspection_data": insp.inspection_data or {},
                "observations": insp.observations,
                "agent_conclusion": insp.agent_conclusion,
                "photos": insp.photos or [],
                "manager_decision": insp.manager_decision,
                "manager_comment": insp.manager_comment,
                "submitted_at": insp.submitted_at,
                "decided_at": insp.decided_at,
                "agent": agent_info,
                "vehicle": vehicle_info,
                "mission": None,
            })
        
        return output
        
    except Exception as e:
        logger.error(f"[INSPECTIONS][PENDING] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.get("/{inspection_id}", response_model=InspectionOut)
async def get_inspection(
    inspection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        result = await db.execute(select(Inspection).where(Inspection.id == inspection_id))
        inspection = result.scalar_one_or_none()
        if not inspection:
            raise HTTPException(status_code=404, detail=f"Inspection {inspection_id} introuvable.")
        
        if user.role == UserRole.agent and inspection.agent_id != user.id:
            raise HTTPException(status_code=403, detail="Accès refusé : ce n'est pas votre inspection.")
        
        agent_info = None
        if inspection.agent_id:
            agent_result = await db.execute(select(User).where(User.id == inspection.agent_id))
            agent = agent_result.scalar_one_or_none()
            if agent:
                agent_info = {"id": str(agent.id), "full_name": agent.full_name}
        
        vehicle_info = None
        if inspection.vehicle_id:
            vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == inspection.vehicle_id))
            vehicle = vehicle_result.scalar_one_or_none()
            if vehicle:
                vehicle_info = {
                    "id": str(vehicle.id),
                    "plate_number": vehicle.plate_number,
                    "brand": vehicle.brand,
                    "model": vehicle.model
                }
        
        return {
            "id": inspection.id,
            "mission_id": inspection.mission_id,
            "vehicle_id": inspection.vehicle_id,
            "agent_id": inspection.agent_id,
            "mileage_at_inspection": inspection.mileage_at_inspection,
            "inspection_data": inspection.inspection_data or {},
            "observations": inspection.observations,
            "agent_conclusion": inspection.agent_conclusion,
            "photos": inspection.photos or [],
            "manager_decision": inspection.manager_decision,
            "manager_comment": inspection.manager_comment,
            "submitted_at": inspection.submitted_at,
            "decided_at": inspection.decided_at,
            "agent": agent_info,
            "vehicle": vehicle_info,
            "mission": None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[INSPECTIONS][GET] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


# ============================================================================
# ✅ ENDPOINT VALIDATION - CORRIGÉ
# ============================================================================

@router.put("/{inspection_id}/validate", response_model=InspectionOut)
async def validate_inspection(
    inspection_id: uuid.UUID,
    body: InspectionManagerAction,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.manager, UserRole.admin))
):
    try:
        result = await db.execute(select(Inspection).where(Inspection.id == inspection_id))
        inspection = result.scalar_one_or_none()
        if not inspection:
            raise HTTPException(status_code=404, detail=f"Inspection {inspection_id} introuvable.")
        
        inspection.manager_decision = ManagerDecision.approved
        inspection.manager_comment = body.comment
        inspection.decided_at = datetime.utcnow()
        
        m_result = await db.execute(select(Mission).where(Mission.id == inspection.mission_id))
        mission = m_result.scalar_one_or_none()
        if mission:
            mission.status = MissionStatus.APPROUVEE
            mission.updated_at = datetime.utcnow()
            logger.info(f"[INSPECTIONS] Mission {mission.id} passe en APPROUVEE")
        
        await db.commit()
        await db.refresh(inspection)
        
        logger.info(f"[INSPECTIONS] Validation par {user.email} - Inspection {inspection_id}")
        
        agent_info = None
        if inspection.agent_id:
            agent_result = await db.execute(select(User).where(User.id == inspection.agent_id))
            agent = agent_result.scalar_one_or_none()
            if agent:
                agent_info = {"id": str(agent.id), "full_name": agent.full_name}
        
        vehicle_info = None
        if inspection.vehicle_id:
            vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == inspection.vehicle_id))
            vehicle = vehicle_result.scalar_one_or_none()
            if vehicle:
                vehicle_info = {
                    "id": str(vehicle.id),
                    "plate_number": vehicle.plate_number,
                    "brand": vehicle.brand,
                    "model": vehicle.model
                }

        mission_info = None
        if mission:
            mission_info = {"id": str(mission.id), "destination": mission.destination}
        
        return {
            "id": inspection.id,
            "mission_id": inspection.mission_id,
            "vehicle_id": inspection.vehicle_id,
            "agent_id": inspection.agent_id,
            "mileage_at_inspection": inspection.mileage_at_inspection,
            "inspection_data": inspection.inspection_data or {},
            "observations": inspection.observations,
            "agent_conclusion": inspection.agent_conclusion,
            "photos": inspection.photos or [],
            "manager_decision": inspection.manager_decision,
            "manager_comment": inspection.manager_comment,
            "submitted_at": inspection.submitted_at,
            "decided_at": inspection.decided_at,
            "agent": agent_info,
            "vehicle": vehicle_info,
            "mission": mission_info,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[INSPECTIONS][VALIDATE] {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


# ============================================================================
# ✅ ENDPOINT REJET - CORRIGÉ AVEC VALIDATION DU COMMENTAIRE
# ============================================================================

@router.put("/{inspection_id}/reject", response_model=InspectionOut)
async def reject_inspection(
    inspection_id: uuid.UUID,
    body: InspectionManagerAction,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.manager, UserRole.admin))
):
    """
    Rejette une inspection.
    
    Effets:
    - Inspection passe en 'rejected'
    - Mission passe en 'NOUVEAU_VEHICULE_REQUIS'
    - Si agent_conclusion == 'unfit' → véhicule bloqué
    - Sinon → véhicule libéré (devient actif)
    """
    try:
        result = await db.execute(select(Inspection).where(Inspection.id == inspection_id))
        inspection = result.scalar_one_or_none()
        if not inspection:
            raise HTTPException(status_code=404, detail=f"Inspection {inspection_id} introuvable.")
        
        # ✅ Validation du commentaire - minimum 5 caractères
        if not body.comment or len(body.comment.strip()) < 5:
            raise HTTPException(status_code=400, detail="Le commentaire de rejet est obligatoire (minimum 5 caractères)")
        
        inspection.manager_decision = ManagerDecision.rejected
        inspection.manager_comment = body.comment
        inspection.decided_at = datetime.utcnow()
        
        # Gestion du statut du véhicule selon la conclusion de l'agent
        if inspection.agent_conclusion == AgentConclusion.unfit:
            # Véhicule inapte → bloqué
            await db.execute(
                update(Vehicle)
                .where(Vehicle.id == inspection.vehicle_id)
                .values(status=VehicleStatus.blocked)
            )
            logger.info(f"[INSPECTIONS] Véhicule {inspection.vehicle_id} bloqué (unfit)")
        else:
            # Véhicule warning ou fit mais rejeté → libérer pour réattribution
            await db.execute(
                update(Vehicle)
                .where(Vehicle.id == inspection.vehicle_id)
                .values(status=VehicleStatus.active)
            )
            logger.info(f"[INSPECTIONS] Véhicule {inspection.vehicle_id} libéré pour réattribution")
        
        # Mettre à jour la mission
        m_result = await db.execute(select(Mission).where(Mission.id == inspection.mission_id))
        mission = m_result.scalar_one_or_none()
        if mission:
            mission.status = MissionStatus.NOUVEAU_VEHICULE_REQUIS
            mission.updated_at = datetime.utcnow()
            
            if mission.vehicle_attempt_count >= 3:
                logger.critical(f"[ALERTE CRITIQUE - CDC 4.3] 3 véhicules inaptes pour mission {mission.id}")
        
        await db.commit()
        await db.refresh(inspection)
        
        logger.info(f"[INSPECTIONS] Rejet par {user.email} - Inspection {inspection_id}")
        
        agent_info = None
        if inspection.agent_id:
            agent_result = await db.execute(select(User).where(User.id == inspection.agent_id))
            agent = agent_result.scalar_one_or_none()
            if agent:
                agent_info = {"id": str(agent.id), "full_name": agent.full_name}
        
        vehicle_info = None
        if inspection.vehicle_id:
            vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == inspection.vehicle_id))
            vehicle = vehicle_result.scalar_one_or_none()
            if vehicle:
                vehicle_info = {
                    "id": str(vehicle.id),
                    "plate_number": vehicle.plate_number,
                    "brand": vehicle.brand,
                    "model": vehicle.model
                }

        mission_info = None
        if mission:
            mission_info = {"id": str(mission.id), "destination": mission.destination}
        
        return {
            "id": inspection.id,
            "mission_id": inspection.mission_id,
            "vehicle_id": inspection.vehicle_id,
            "agent_id": inspection.agent_id,
            "mileage_at_inspection": inspection.mileage_at_inspection,
            "inspection_data": inspection.inspection_data or {},
            "observations": inspection.observations,
            "agent_conclusion": inspection.agent_conclusion,
            "photos": inspection.photos or [],
            "manager_decision": inspection.manager_decision,
            "manager_comment": inspection.manager_comment,
            "submitted_at": inspection.submitted_at,
            "decided_at": inspection.decided_at,
            "agent": agent_info,
            "vehicle": vehicle_info,
            "mission": mission_info,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[INSPECTIONS][REJECT] {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


# ============================================================================
# ENDPOINT PDF
# ============================================================================

@router.get("/{inspection_id}/pdf", summary="Télécharger le rapport PDF de l'inspection")
async def export_pdf(
    inspection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        result = await db.execute(select(Inspection).where(Inspection.id == inspection_id))
        inspection = result.scalar_one_or_none()
        if not inspection:
            raise HTTPException(status_code=404, detail=f"Inspection {inspection_id} introuvable.")
        
        if user.role == UserRole.agent and inspection.agent_id != user.id:
            raise HTTPException(status_code=403, detail="Accès refusé.")
        
        v_res = await db.execute(select(Vehicle).where(Vehicle.id == inspection.vehicle_id))
        vehicle = v_res.scalar_one_or_none()
        
        a_res = await db.execute(select(User).where(User.id == inspection.agent_id))
        agent = a_res.scalar_one_or_none()
        
        m_res = await db.execute(select(Mission).where(Mission.id == inspection.mission_id))
        mission = m_res.scalar_one_or_none()
        
        html_content = _build_pdf_html(inspection, vehicle, agent, mission)
        
        filename = f"ENEO_Checkup_{vehicle.plate_number if vehicle else 'unknown'}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.html"
        
        return StreamingResponse(
            io.BytesIO(html_content.encode("utf-8")),
            media_type="text/html",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "text/html; charset=utf-8"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[INSPECTIONS][PDF] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération rapport : {str(e)}")


@router.get("/vehicle/{vehicle_id}/history", response_model=List[InspectionOut])
async def get_vehicle_inspection_history(
    vehicle_id: uuid.UUID,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.manager, UserRole.admin))
):
    try:
        result = await db.execute(
            select(Inspection).where(Inspection.vehicle_id == vehicle_id)
            .order_by(Inspection.submitted_at.desc())
            .limit(limit)
        )
        inspections = result.scalars().all()
        
        output = []
        for insp in inspections:
            agent_info = None
            if insp.agent_id:
                agent_result = await db.execute(select(User).where(User.id == insp.agent_id))
                agent = agent_result.scalar_one_or_none()
                if agent:
                    agent_info = {"id": str(agent.id), "full_name": agent.full_name}
            
            output.append({
                "id": insp.id,
                "mission_id": insp.mission_id,
                "vehicle_id": insp.vehicle_id,
                "agent_id": insp.agent_id,
                "mileage_at_inspection": insp.mileage_at_inspection,
                "inspection_data": insp.inspection_data or {},
                "observations": insp.observations,
                "agent_conclusion": insp.agent_conclusion,
                "photos": insp.photos or [],
                "manager_decision": insp.manager_decision,
                "manager_comment": insp.manager_comment,
                "submitted_at": insp.submitted_at,
                "decided_at": insp.decided_at,
                "agent": agent_info,
                "vehicle": None,
                "mission": None,
            })
        
        return output
        
    except Exception as e:
        logger.error(f"[INSPECTIONS][VEHICLE_HISTORY] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")