import logging
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, Field

from app.database import get_db
from app.models.user import User, UserRole
from app.core.dependencies import get_current_user, require_role
from app.core.security import hash_password, verify_password

logger = logging.getLogger("fims")
router = APIRouter(prefix="/api/users", tags=["Utilisateurs"])


# ── Schémas Pydantic ─────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    full_name:  str      = Field(..., min_length=2, example="Jean Dupont")
    email:      EmailStr = Field(..., example="jean@fims.cm")
    password:   str      = Field(..., min_length=8, example="motdepasse123")
    role:       UserRole = Field(default=UserRole.agent, example="agent")
    department: Optional[str] = Field(None, example="SUPPORT LOGISTIQUE")


class UserUpdate(BaseModel):
    full_name:  Optional[str]      = None
    email:      Optional[EmailStr] = None
    role:       Optional[UserRole] = None
    department: Optional[str]      = None
    is_active:  Optional[bool]     = None


class UserOut(BaseModel):
    id:         uuid.UUID
    full_name:  str
    email:      str
    role:       UserRole
    department: Optional[str] = None
    is_active:  bool
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password:     str = Field(..., min_length=6)


# ── Endpoints Admin ───────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=List[UserOut],
    summary="Lister tous les utilisateurs",
    description="**Admin uniquement.** Retourne tous les comptes utilisateurs."
)
async def list_users(
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(require_role(UserRole.admin))
):
    try:
        result = await db.execute(select(User).order_by(User.created_at.desc()))
        return result.scalars().all()
    except Exception as e:
        logger.error(f"[USERS][LIST] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/",
    response_model=UserOut,
    status_code=201,
    summary="Créer un utilisateur",
    description="""
**Admin uniquement.**

Crée un nouvel utilisateur. Le rôle `unit_supervisor` est disponible
pour les responsables d'unité (accès lecture seule sur leur parc).

Rôles disponibles : `agent`, `manager`, `admin`, `unit_supervisor`
    """
)
async def create_user(
    body: UserCreate,
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(require_role(UserRole.admin))
):
    try:
        existing = await db.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"L'email {body.email} est déjà utilisé."
            )

        new_user = User(
            full_name     = body.full_name,
            email         = body.email,
            password_hash = hash_password(body.password),
            role          = body.role,
            department    = body.department,
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

        logger.info(f"[USERS] Créé : {new_user.email} — rôle : {new_user.role.value}")
        return new_user

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[USERS][CREATE] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{user_id}",
    response_model=UserOut,
    summary="Détail d'un utilisateur",
    description="**Admin uniquement.**"
)
async def get_user(
    user_id: uuid.UUID,
    db:      AsyncSession = Depends(get_db),
    user:    User         = Depends(require_role(UserRole.admin))
):
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        found = result.scalar_one_or_none()
        if not found:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        return found
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[USERS][GET] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{user_id}",
    response_model=UserOut,
    summary="Modifier un utilisateur",
    description="**Admin uniquement.** Modifie les informations ou le rôle d'un utilisateur."
)
async def update_user(
    user_id: uuid.UUID,
    body:    UserUpdate,
    db:      AsyncSession = Depends(get_db),
    user:    User         = Depends(require_role(UserRole.admin))
):
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        found = result.scalar_one_or_none()
        if not found:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

        if body.full_name  is not None: found.full_name  = body.full_name
        if body.role       is not None: found.role       = body.role
        if body.department is not None: found.department = body.department
        if body.is_active  is not None: found.is_active  = body.is_active

        if body.email is not None and body.email != found.email:
            dup = await db.execute(select(User).where(User.email == body.email))
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")
            found.email = body.email

        await db.commit()
        await db.refresh(found)
        return found

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[USERS][UPDATE] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/{user_id}",
    summary="Supprimer un utilisateur",
    description="**Admin uniquement.** Impossible de supprimer son propre compte."
)
async def delete_user(
    user_id: uuid.UUID,
    db:      AsyncSession = Depends(get_db),
    user:    User         = Depends(require_role(UserRole.admin))
):
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        found = result.scalar_one_or_none()
        if not found:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        if found.id == user.id:
            raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte.")

        await db.delete(found)
        await db.commit()
        logger.info(f"[USERS] Supprimé : {found.email}")
        return {"message": f"Utilisateur {found.full_name} supprimé avec succès."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[USERS][DELETE] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Endpoints Profil (tous rôles) ─────────────────────────────────────────────

@router.get(
    "/me",
    response_model=UserOut,
    summary="Mon profil",
    description="Retourne le profil de l'utilisateur connecté. Accessible à tous les rôles."
)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put(
    "/me",
    response_model=UserOut,
    summary="Modifier mon profil",
    description="Modifie le nom, l'email ou le département de l'utilisateur connecté."
)
async def update_current_user(
    body:         UserUpdate,
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(get_current_user)
):
    try:
        if body.full_name:  current_user.full_name  = body.full_name
        if body.department is not None: current_user.department = body.department

        if body.email and body.email != current_user.email:
            dup = await db.execute(select(User).where(User.email == body.email))
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")
            current_user.email = body.email

        await db.commit()
        await db.refresh(current_user)
        return current_user

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[USERS][UPDATE_ME] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/change-password",
    summary="Changer mon mot de passe",
    description="Accessible à tous les rôles connectés."
)
async def change_password(
    body:         ChangePasswordBody,
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(get_current_user)
):
    try:
        if not verify_password(body.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")

        current_user.password_hash = hash_password(body.new_password)
        await db.commit()
        return {"message": "Mot de passe modifié avec succès."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[USERS][CHANGE_PASSWORD] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))