# app/services/notification_service.py
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.mission import Mission
from app.models.inspection import Inspection
from app.models.user import User

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Fonction interne d'envoi SMTP
# ─────────────────────────────────────────────

async def _send_email(to: str, subject: str, html_body: str) -> bool:
    """Envoi d'un email HTML via SMTP. Retourne True si succès."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_USER
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to, msg.as_string())

        logger.info(f"Email envoyé à {to} — Sujet: {subject}")
        return True
    except Exception as e:
        logger.error(f"Échec envoi email à {to}: {e}")
        return False


# ─────────────────────────────────────────────
# Templates HTML des emails
# ─────────────────────────────────────────────

def _template_base(title: str, color: str, content: str) -> str:
    """Template HTML de base réutilisable pour tous les emails FIMS."""
    return f"""
    <html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
      <div style="background:{color};padding:24px 32px">
        <h1 style="color:#fff;margin:0;font-size:20px">FIMS — {title}</h1>
      </div>
      <div style="padding:32px">
        {content}
        <hr style="margin:32px 0;border:none;border-top:1px solid #eee">
        <p style="color:#999;font-size:12px;margin:0">
          Fleet Inspection &amp; Management System — Ne pas répondre à cet email.
        </p>
      </div>
    </div>
    </body></html>
    """


def _tpl_new_mission(agent_name: str, destination: str, mission_date: str, purpose: str) -> str:
    return _template_base(
        title="Nouvelle demande de mission",
        color="#2563EB",
        content=f"""
        <p>Bonjour,</p>
        <p>Une nouvelle demande de mission vient d'être soumise et nécessite votre traitement.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold;width:40%">Agent</td>
              <td style="padding:8px">{agent_name}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Destination</td>
              <td style="padding:8px">{destination}</td></tr>
          <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold">Date mission</td>
              <td style="padding:8px;background:#f8f8f8">{mission_date}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Motif</td>
              <td style="padding:8px">{purpose}</td></tr>
        </table>
        <p>Connectez-vous à l'application pour attribuer un véhicule.</p>
        <a href="{settings.FRONTEND_URL}/missions" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Traiter la demande</a>
        """
    )


def _tpl_vehicle_assigned(agent_name: str, plate_number: str, brand: str, model: str, destination: str) -> str:
    return _template_base(
        title="Véhicule attribué — Action requise",
        color="#059669",
        content=f"""
        <p>Bonjour {agent_name},</p>
        <p>Un véhicule vous a été attribué pour votre mission. Veuillez procéder à l'inspection.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold;width:40%">Immatriculation</td>
              <td style="padding:8px;font-size:18px;font-weight:bold;color:#059669">{plate_number}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Véhicule</td>
              <td style="padding:8px">{brand} {model}</td></tr>
          <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold">Destination</td>
              <td style="padding:8px;background:#f8f8f8">{destination}</td></tr>
        </table>
        <p style="background:#FEF3C7;padding:12px;border-radius:6px;color:#92400E">
          ⏰ Vous avez <strong>2 heures</strong> pour soumettre le rapport d'inspection.
        </p>
        <a href="{settings.FRONTEND_URL}/inspections/new" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Démarrer l'inspection</a>
        """
    )


def _tpl_inspection_submitted(manager_name: str, agent_name: str, plate_number: str, conclusion: str) -> str:
    color_map = {"fit": "#059669", "warning": "#D97706", "unfit": "#DC2626"}
    label_map = {"fit": "✅ Apte à l'utilisation", "warning": "⚠️ Utilisable avec réserves", "unfit": "❌ Inapte — ne peut pas être utilisé"}
    color = color_map.get(conclusion, "#2563EB")
    label = label_map.get(conclusion, conclusion)
    return _template_base(
        title="Rapport d'inspection soumis",
        color=color,
        content=f"""
        <p>Bonjour {manager_name},</p>
        <p>Un rapport d'inspection a été soumis et requiert votre décision.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold;width:40%">Agent</td>
              <td style="padding:8px">{agent_name}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Véhicule</td>
              <td style="padding:8px">{plate_number}</td></tr>
          <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold">Conclusion</td>
              <td style="padding:8px;background:#f8f8f8;color:{color};font-weight:bold">{label}</td></tr>
        </table>
        <a href="{settings.FRONTEND_URL}/inspections" style="display:inline-block;background:{color};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Valider ou refuser</a>
        """
    )


def _tpl_mission_approved(agent_name: str, destination: str, plate_number: str) -> str:
    return _template_base(
        title="Mission approuvée — Bonne route !",
        color="#059669",
        content=f"""
        <p>Bonjour {agent_name},</p>
        <p>Votre mission a été <strong style="color:#059669">approuvée</strong> par le Manager.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f8f8f8;font-weight:bold;width:40%">Destination</td>
              <td style="padding:8px">{destination}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Véhicule autorisé</td>
              <td style="padding:8px;font-weight:bold;color:#059669">{plate_number}</td></tr>
        </table>
        <p style="background:#ECFDF5;padding:12px;border-radius:6px;color:#065F46">
          Vous pouvez prendre le véhicule. Bon déplacement !
        </p>
        """
    )


def _tpl_new_vehicle_required(agent_name: str, old_plate: str, manager_comment: str) -> str:
    return _template_base(
        title="Nouveau véhicule requis",
        color="#D97706",
        content=f"""
        <p>Bonjour {agent_name},</p>
        <p>Le véhicule <strong>{old_plate}</strong> a été refusé. Un nouveau véhicule va vous être attribué.</p>
        <p style="background:#FEF3C7;padding:12px;border-radius:6px;color:#92400E">
          <strong>Commentaire du Manager :</strong><br>{manager_comment or "Aucun commentaire."}
        </p>
        <p>Vous serez notifié dès qu'un nouveau véhicule vous est attribué.</p>
        """
    )


def _tpl_mission_rejected(agent_name: str, destination: str, comment: str) -> str:
    return _template_base(
        title="Demande de mission refusée",
        color="#DC2626",
        content=f"""
        <p>Bonjour {agent_name},</p>
        <p>Votre demande de mission pour <strong>{destination}</strong> a été <strong style="color:#DC2626">refusée</strong>.</p>
        <p style="background:#FEF2F2;padding:12px;border-radius:6px;color:#991B1B">
          <strong>Motif du refus :</strong><br>{comment or "Aucun commentaire fourni."}
        </p>
        """
    )


def _tpl_critical_alert(mission_id: str, agent_name: str, destination: str) -> str:
    return _template_base(
        title="🚨 ALERTE CRITIQUE — 3 véhicules inaptes",
        color="#DC2626",
        content=f"""
        <p><strong>Attention — Intervention immédiate requise.</strong></p>
        <p>3 véhicules successifs ont échoué l'inspection pour la mission suivante :</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#FEF2F2;font-weight:bold">Agent</td>
              <td style="padding:8px;background:#FEF2F2">{agent_name}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Destination</td>
              <td style="padding:8px">{destination}</td></tr>
          <tr><td style="padding:8px;background:#FEF2F2;font-weight:bold">ID Mission</td>
              <td style="padding:8px;background:#FEF2F2;font-family:monospace">{mission_id}</td></tr>
        </table>
        <p style="background:#FEF2F2;padding:12px;border-radius:6px;color:#991B1B;font-weight:bold">
          La Direction doit intervenir immédiatement pour débloquer la situation.
        </p>
        <a href="{settings.FRONTEND_URL}/missions/{mission_id}" style="display:inline-block;background:#DC2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Voir la mission</a>
        """
    )


# ─────────────────────────────────────────────
# Fonction principale du service
# ─────────────────────────────────────────────

async def notify(event: str, payload: object, db: AsyncSession) -> None:
    """
    Point d'entrée unique pour toutes les notifications.

    Événements disponibles :
    - new_mission_request      → notifie tous les Managers
    - vehicle_assigned         → notifie l'Agent
    - inspection_submitted     → notifie tous les Managers
    - mission_approved         → notifie l'Agent
    - new_vehicle_required     → notifie l'Agent
    - mission_rejected         → notifie l'Agent
    - critical_alert_3_vehicles → notifie Managers + Direction (admin)
    """

    async def get_user(user_id) -> Optional[User]:
        if not user_id:
            return None
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_managers() -> list[User]:
        result = await db.execute(select(User).where(User.role.in_(["manager", "admin"]), User.is_active == True))
        return result.scalars().all()

    try:
        # ── Nouvelle demande de mission ──────────────────────────────
        if event == "new_mission_request" and isinstance(payload, Mission):
            agent = await get_user(payload.agent_id)
            managers = await get_managers()
            for mgr in managers:
                await _send_email(
                    to=mgr.email,
                    subject=f"[FIMS] Nouvelle demande de mission — {agent.full_name if agent else 'Agent'}",
                    html_body=_tpl_new_mission(
                        agent_name=agent.full_name if agent else "Agent",
                        destination=payload.destination,
                        mission_date=str(payload.mission_date),
                        purpose=payload.purpose
                    )
                )

        # ── Véhicule attribué → Agent ────────────────────────────────
        elif event == "vehicle_assigned" and isinstance(payload, Mission):
            agent = await get_user(payload.agent_id)
            if agent and payload.vehicle_id:
                from app.models.vehicle import Vehicle
                v_result = await db.execute(select(Vehicle).where(Vehicle.id == payload.vehicle_id))
                vehicle = v_result.scalar_one_or_none()
                if vehicle:
                    await _send_email(
                        to=agent.email,
                        subject=f"[FIMS] Véhicule attribué — {vehicle.plate_number}",
                        html_body=_tpl_vehicle_assigned(
                            agent_name=agent.full_name,
                            plate_number=vehicle.plate_number,
                            brand=vehicle.brand,
                            model=vehicle.model,
                            destination=payload.destination
                        )
                    )

        # ── Inspection soumise → Managers ────────────────────────────
        elif event == "inspection_submitted" and isinstance(payload, Inspection):
            agent = await get_user(payload.agent_id)
            managers = await get_managers()
            from app.models.vehicle import Vehicle
            v_result = await db.execute(select(Vehicle).where(Vehicle.id == payload.vehicle_id))
            vehicle = v_result.scalar_one_or_none()
            for mgr in managers:
                await _send_email(
                    to=mgr.email,
                    subject=f"[FIMS] Rapport d'inspection soumis — {vehicle.plate_number if vehicle else ''}",
                    html_body=_tpl_inspection_submitted(
                        manager_name=mgr.full_name,
                        agent_name=agent.full_name if agent else "Agent",
                        plate_number=vehicle.plate_number if vehicle else "N/A",
                        conclusion=payload.agent_conclusion.value
                    )
                )

        # ── Mission approuvée → Agent ────────────────────────────────
        elif event == "mission_approved" and isinstance(payload, Inspection):
            mission_result = await db.execute(select(Mission).where(Mission.id == payload.mission_id))
            mission = mission_result.scalar_one_or_none()
            if mission:
                agent = await get_user(mission.agent_id)
                from app.models.vehicle import Vehicle
                v_result = await db.execute(select(Vehicle).where(Vehicle.id == payload.vehicle_id))
                vehicle = v_result.scalar_one_or_none()
                if agent:
                    await _send_email(
                        to=agent.email,
                        subject="[FIMS] ✅ Mission approuvée — Bonne route !",
                        html_body=_tpl_mission_approved(
                            agent_name=agent.full_name,
                            destination=mission.destination,
                            plate_number=vehicle.plate_number if vehicle else "N/A"
                        )
                    )

        # ── Nouveau véhicule requis → Agent ──────────────────────────
        elif event == "new_vehicle_required" and isinstance(payload, Inspection):
            mission_result = await db.execute(select(Mission).where(Mission.id == payload.mission_id))
            mission = mission_result.scalar_one_or_none()
            if mission:
                agent = await get_user(mission.agent_id)
                from app.models.vehicle import Vehicle
                v_result = await db.execute(select(Vehicle).where(Vehicle.id == payload.vehicle_id))
                vehicle = v_result.scalar_one_or_none()
                if agent:
                    await _send_email(
                        to=agent.email,
                        subject="[FIMS] ⚠️ Nouveau véhicule requis",
                        html_body=_tpl_new_vehicle_required(
                            agent_name=agent.full_name,
                            old_plate=vehicle.plate_number if vehicle else "N/A",
                            manager_comment=payload.manager_comment or ""
                        )
                    )

        # ── Mission rejetée → Agent ──────────────────────────────────
        elif event == "mission_rejected" and isinstance(payload, Mission):
            agent = await get_user(payload.agent_id)
            if agent:
                await _send_email(
                    to=agent.email,
                    subject="[FIMS] ❌ Demande de mission refusée",
                    html_body=_tpl_mission_rejected(
                        agent_name=agent.full_name,
                        destination=payload.destination,
                        comment=payload.manager_comment or ""
                    )
                )

        # ── Alerte critique 3 véhicules → Managers + Admins ─────────
        elif event == "critical_alert_3_vehicles" and isinstance(payload, Mission):
            agent = await get_user(payload.agent_id)
            managers = await get_managers()
            for mgr in managers:
                await _send_email(
                    to=mgr.email,
                    subject="[FIMS] 🚨 ALERTE CRITIQUE — 3 véhicules inaptes consécutifs",
                    html_body=_tpl_critical_alert(
                        mission_id=str(payload.id),
                        agent_name=agent.full_name if agent else "Agent",
                        destination=payload.destination
                    )
                )

        else:
            logger.warning(f"Événement de notification inconnu : {event}")

    except Exception as e:
        # Ne jamais faire crasher une route à cause d'un email raté
        logger.error(f"Erreur service notification [{event}]: {e}")