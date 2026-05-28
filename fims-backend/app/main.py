import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

# Configurer les logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("fims")

# Import des modèles
import app.models

from app.routers import auth, users, vehicles, missions, inspections, maintenance, dashboard, supervisor, departments  # ✅ AJOUT supervisor, departments

# ─────────────────────────────────────────────────────────────────────────────
# Application FastAPI
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="FIMS — Fleet Inspection & Management System",
    description="""
## Système de Gestion des Inspections de Véhicules

### 🔐 Comment s'authentifier
1. `POST /api/auth/login` avec votre email et mot de passe
2. Copiez le `access_token` retourné
3. Cliquez **Authorize 🔒** en haut à droite
4. Saisissez : `Bearer <votre_token>`

---

### 👥 Rôles et accès
| Rôle | Accès |
|------|-------|
| `admin` | ✅ Accès total à tous les endpoints |
| `manager` | Véhicules, missions, inspections, maintenance, dashboard |
| `agent` | Ses propres missions et inspections uniquement |
| `unit_supervisor` | 👁️ Supervision lecture seule - consultation de son parc |

---

### 📋 Comptes de test
| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@fims.cm | password123 | Admin |
| manager@fims.cm | password123 | Manager |
| agent@fims.cm | password123 | Agent |
| supervisor@fims.cm | password123 | Responsable d'Unité |
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    swagger_ui_parameters={
        "persistAuthorization": True,
    }
)

# ✅ Middleware CORS CORRIGÉ
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://intelligent-manifestation-production.up.railway.app",

    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Handler global d'erreurs
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"[500] {request.method} {request.url.path} — {type(exc).__name__}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Erreur interne : {type(exc).__name__} — {str(exc)}"}
    )

# ─────────────────────────────────────────────────────────────────────────────
# ROUTERS - Pas de doublons, chaque router a un tag unique
# ─────────────────────────────────────────────────────────────────────────────
app.include_router(auth.router)           # tag déjà dans auth.py
app.include_router(users.router)          # tag déjà dans users.py
app.include_router(vehicles.router)       # tag déjà dans vehicles.py
app.include_router(missions.router)       # tag déjà dans missions.py
app.include_router(inspections.router)    # tag déjà dans inspections.py
app.include_router(maintenance.router)    # tag déjà dans maintenance.py
app.include_router(dashboard.router)      # tag déjà dans dashboard.py
app.include_router(supervisor.router)     # ✅ AJOUT - tag déjà dans supervisor.py
app.include_router(departments.router)    # tag déjà dans departments.py

# Health check
@app.get("/health", tags=["Système"], summary="Vérifier que l'API est en ligne")
async def health():
    return {"status": "ok", "service": "FIMS API", "version": "1.0.0"}

# ─────────────────────────────────────────────────────────────────────────────
# Schéma OpenAPI - Version corrigée sans doublons
# ─────────────────────────────────────────────────────────────────────────────
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    # Configuration de la sécurité Bearer
    if "components" not in schema:
        schema["components"] = {}
    schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Entrez: Bearer <votre_access_token>"
        }
    }

    # Appliquer la sécurité à toutes les routes SAUF login, refresh, health
    public_paths = ["/api/auth/login", "/api/auth/refresh", "/health"]
    
    for path in schema["paths"]:
        if path in public_paths:
            continue
        for method in schema["paths"][path]:
            schema["paths"][path][method]["security"] = [{"BearerAuth": []}]
    
    # SUPPRESSION DES DOUBLONS DE TAGS
    for path_data in schema["paths"].values():
        for operation in path_data.values():
            if "tags" in operation and len(operation["tags"]) > 1:
                # Garder uniquement le premier tag
                operation["tags"] = [operation["tags"][0]]

    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = custom_openapi