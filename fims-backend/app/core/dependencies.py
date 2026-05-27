import logging
import uuid
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core.security import decode_token

logger = logging.getLogger("fims")

# auto_error=True : FastAPI renvoie 403 automatiquement si le header Authorization est absent
bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    """
    Décode le JWT et retourne l'utilisateur connecté.
    
    CORRECTION CRITIQUE :
    jose.jwt.decode() retourne toujours "sub" comme une STRING.
    SQLAlchemy avec UUID(as_uuid=True) attend un objet uuid.UUID Python.
    Sans la conversion uuid.UUID(user_id), la requête SELECT retourne None
    sur certaines versions de asyncpg, ce qui donne "mot de passe incorrect"
    même si le compte existe bien dans la base.
    """
    try:
        payload = decode_token(credentials.credentials)

        if payload.get("type") != "access":
            raise HTTPException(
                status_code=401,
                detail="Utilisez le access_token, pas le refresh_token."
            )

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=401,
                detail="Token invalide : champ 'sub' manquant."
            )

        # ✅ CONVERSION STRING → UUID.UUID (correction du bug)
        try:
            user_uuid = uuid.UUID(str(user_id_str))
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=401,
                detail="Token invalide : identifiant utilisateur malformé."
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AUTH] Erreur décodage token : {e}")
        raise HTTPException(
            status_code=401,
            detail="Token invalide ou expiré. Reconnectez-vous."
        )

    from app.models.user import User

    # ✅ On compare UUID Python ↔ colonne UUID PostgreSQL — ça fonctionne toujours
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable.")

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Compte bloqué. Contactez l'administrateur : admin@fims.cm",
        )

    return user


def require_role(*roles):
    """
    Dépendance RBAC — restreint l'accès à certains rôles.
    L'admin bypass toutes les restrictions (accès total).

    Usage :
        user = Depends(require_role(UserRole.manager, UserRole.admin))
        user = Depends(require_role(UserRole.unit_supervisor))
    """
    async def checker(user=Depends(get_current_user)):
        from app.models.user import UserRole

        # Admin : accès total sans restriction
        if user.role == UserRole.admin:
            return user

        if user.role not in roles:
            roles_str = ", ".join([r.value for r in roles])
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Accès refusé. "
                    f"Votre rôle : '{user.role.value}'. "
                    f"Rôles autorisés : {roles_str}."
                ),
            )
        return user

    return checker