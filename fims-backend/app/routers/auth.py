import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, EmailStr, Field

from app.database import get_db
from app.models.user import User
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.dependencies import get_current_user

logger = logging.getLogger("fims")
router = APIRouter(prefix="/api/auth", tags=["Authentification"])

# ── Schemas ────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr = Field(..., example="admin@fims.cm")
    password: str = Field(..., example="password123")

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    role: str
    user_id: str
    full_name: str
    message: str

class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")

class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., example="password123")
    new_password: str = Field(..., min_length=8, example="nouveauPass2025")

# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Connexion utilisateur",
    description="""
**Accessible a tous (public).**

Authentifie un utilisateur et retourne les tokens JWT.

---
**Etape 1** : Entrez email + password et executez.

**Etape 2** : Copiez la valeur du champ `access_token`.

**Etape 3** : Cliquez le bouton **Authorize (cadenas)** en haut a droite du Swagger.

**Etape 4** : Dans le champ `Value`, saisissez : `Bearer <votre_access_token>`

**Etape 5** : Cliquez **Authorize** puis **Close**. Tous les endpoints sont maintenant debloqus.

---
**Comptes de test :**

| Email | Mot de passe | Role |
|---|---|---|
| admin@fims.cm | password123 | Admin - acces total |
| manager@fims.cm | password123 | Manager - gestion parc et validations |
| agent@fims.cm | password123 | Agent - missions et inspections |
| supervisor@fims.cm | password123 | Responsable d'Unité - supervision lecture seule |

> Le compte est bloque apres **5 tentatives echouees**.
    """,
    responses={
        200: {"description": "Connexion reussie - copiez le access_token"},
        401: {"description": "Email ou mot de passe incorrect"},
        403: {"description": "Compte bloque apres 5 tentatives"},
    }
)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        # 🔍 LOG 1: Début de la tentative de connexion
        logger.info(f"🔍 [LOGIN] Tentative de connexion pour: {body.email}")
        
        result = await db.execute(select(User).where(User.email == body.email))
        user = result.scalar_one_or_none()
        
        # 🔍 LOG 2: Utilisateur trouvé ?
        if user:
            logger.info(f"✅ [LOGIN] Utilisateur trouvé: {user.email}, Role: {user.role}, Actif: {user.is_active}")
            logger.info(f"🔐 [LOGIN] Hash stocké: {user.password_hash[:30]}... (longueur: {len(user.password_hash) if user.password_hash else 0})")
        else:
            logger.warning(f"❌ [LOGIN] Utilisateur non trouvé: {body.email}")

        if not user or not verify_password(body.password, user.password_hash):
            # 🔍 LOG 3: Échec de vérification du mot de passe
            if user:
                logger.warning(f"❌ [LOGIN] Mot de passe incorrect pour: {user.email}")
                current_attempts = user.failed_login_attempts or 0
                new_attempts = current_attempts + 1
                logger.warning(f"⚠️ [LOGIN] Tentative échouée #{new_attempts} pour {user.email}")
                
                await db.execute(
                    update(User).where(User.id == user.id).values(
                        failed_login_attempts=new_attempts,
                        is_active=(new_attempts < 5)
                    )
                )
                await db.commit()
                if new_attempts >= 5:
                    logger.error(f"🔒 [LOGIN] Compte {user.email} bloqué après 5 tentatives")
                    raise HTTPException(
                        status_code=403,
                        detail="Compte bloque apres 5 tentatives. Contactez admin@fims.cm"
                    )
            else:
                logger.warning(f"❌ [LOGIN] Aucun utilisateur avec l'email: {body.email}")
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect.")

        # 🔍 LOG 4: Compte inactif
        if not user.is_active:
            logger.error(f"🔒 [LOGIN] Tentative de connexion sur compte inactif: {user.email}")
            raise HTTPException(
                status_code=403,
                detail="Compte bloque. Contactez l'administrateur : admin@fims.cm"
            )

        # Reset tentatives
        await db.execute(update(User).where(User.id == user.id).values(failed_login_attempts=0))
        await db.commit()

        # 🔍 LOG 5: Succès de la connexion
        logger.info(f"✅ [LOGIN] Connexion réussie pour: {user.email}, Role: {user.role.value}")

        token_data = {"sub": str(user.id), "role": user.role.value, "email": user.email}

        role_desc = {
            "admin": "Acces total a tous les endpoints",
            "manager": "Gestion parc, missions, inspections, maintenance, dashboard",
            "agent": "Soumission missions et inspections uniquement",
            "unit_supervisor": "Supervision lecture seule - consultation de votre parc uniquement",
        }.get(user.role.value, "")

        return {
            "access_token": create_access_token(token_data),
            "refresh_token": create_refresh_token(token_data),
            "token_type": "bearer",
            "role": user.role.value,
            "user_id": str(user.id),
            "full_name": user.full_name,
            "message": f"Bienvenue {user.full_name} ! {role_desc}",
        }
    except HTTPException:
        raise
    except Exception as e:
        # 🔍 LOG 6: Erreur inattendue
        logger.error(f"💥 [LOGIN] Erreur inattendue: {type(e).__name__} - {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rafraichir le token",
    description="Genere un nouveau access_token a partir du refresh_token (valide 7 jours).",
)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        logger.info(f"🔄 [REFRESH] Tentative de rafraîchissement de token")
        
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            logger.warning(f"❌ [REFRESH] Token n'est pas un refresh_token")
            raise HTTPException(status_code=400, detail="Ce token n'est pas un refresh_token.")
        
        result = await db.execute(select(User).where(User.id == payload["sub"]))
        user = result.scalar_one_or_none()
        if not user:
            logger.warning(f"❌ [REFRESH] Utilisateur non trouvé: {payload.get('sub')}")
            raise HTTPException(status_code=401, detail="Utilisateur introuvable.")
        
        logger.info(f"✅ [REFRESH] Token rafraîchi pour: {user.email}")
        
        token_data = {"sub": str(user.id), "role": user.role.value, "email": user.email}
        return {
            "access_token": create_access_token(token_data),
            "refresh_token": create_refresh_token(token_data),
            "token_type": "bearer",
            "role": user.role.value,
            "user_id": str(user.id),
            "full_name": user.full_name,
            "message": "Token renouvele avec succes.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 [REFRESH] Erreur: {type(e).__name__} - {str(e)}", exc_info=True)
        raise HTTPException(status_code=401, detail="Refresh token invalide ou expire.")


@router.get(
    "/me",
    summary="Mon profil connecte",
    description="""
**Accessible a tous les roles connectes (Agent, Manager, Admin, Responsable d'Unité).**

Retourne les informations de l'utilisateur dont le token est fourni.
Utile pour verifier que vous etes bien authentifie apres avoir clique Authorize.
    """,
)
async def get_me(user=Depends(get_current_user)):
    permissions = {
        "admin": ["Gestion utilisateurs", "Gestion parc complet", "Toutes les missions", "Toutes les inspections", "Dashboard", "Maintenance"],
        "manager": ["Gestion parc", "Attribuer vehicules", "Valider/rejeter inspections", "Dashboard", "Maintenance"],
        "agent": ["Creer mission", "Soumettre inspection", "Voir ses propres donnees"],
        "unit_supervisor": ["Lecture seule", "Consulter vehicules de son unite", "Consulter inspections", "Signaler a un agent"],
    }
    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active,
        "permissions": permissions.get(user.role.value, []),
        "message": f"Connecte en tant que {user.role.value.upper()} - {user.full_name}",
    }


@router.post(
    "/change-password",
    summary="Changer son mot de passe",
    description="**Accessible a tous les roles connectes.** Modifie le mot de passe de l'utilisateur connecte.",
)
async def change_password(
    body: ChangePasswordRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        from app.core.security import hash_password
        logger.info(f"🔐 [CHANGE-PWD] Tentative de changement de mot de passe pour: {user.email}")
        
        if not verify_password(body.old_password, user.password_hash):
            logger.warning(f"❌ [CHANGE-PWD] Ancien mot de passe incorrect pour: {user.email}")
            raise HTTPException(status_code=400, detail="Ancien mot de passe incorrect.")
        
        await db.execute(
            update(User).where(User.id == user.id)
            .values(password_hash=hash_password(body.new_password))
        )
        await db.commit()
        
        logger.info(f"✅ [CHANGE-PWD] Mot de passe changé avec succès pour: {user.email}")
        return {"message": f"Mot de passe de {user.full_name} modifie avec succes."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 [CHANGE-PWD] Erreur: {type(e).__name__} - {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")