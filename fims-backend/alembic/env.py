from logging.config import fileConfig
import os
import sys

from sqlalchemy import engine_from_config, pool
from alembic import context

# Ajouter le répertoire racine au path Python
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import de tous les modèles pour l'autogenerate
from app.database import Base
from app.models.department import Department
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.mission import Mission
from app.models.inspection import Inspection
from app.models.maintenance import MaintenanceTask

# Config Alembic
config = context.config

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# URL de connexion synchrone hardcodée pour Alembic
# URL de connexion - utilise la variable d'environnement en production
SYNC_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://fims_user:12345678@db:5432/fims_db"
)
if SYNC_DATABASE_URL.startswith("postgresql+asyncpg://"):
    SYNC_DATABASE_URL = SYNC_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
config.set_main_option("sqlalchemy.url", SYNC_DATABASE_URL)

# Métadonnées cibles pour l'autogenerate
target_metadata = Base.metadata


def upgrade_enum():
    """Fonction pour mettre à jour l'enum userrole avec la nouvelle valeur"""
    try:
        from sqlalchemy import text
        conn = context.get_bind()
        # Vérifier si la valeur existe déjà
        result = conn.execute(text("SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'userrole'::regtype AND enumlabel = 'unit_supervisor')"))
        exists = result.scalar()
        if not exists:
            # Ajouter la nouvelle valeur à l'enum
            conn.execute(text("ALTER TYPE userrole ADD VALUE 'unit_supervisor'"))
            print("✅ Valeur 'unit_supervisor' ajoutée à l'enum userrole")
        else:
            print("ℹ️ La valeur 'unit_supervisor' existe déjà dans l'enum userrole")
    except Exception as e:
        print(f"⚠️ Erreur lors de la mise à jour de l'enum: {e}")
        # L'erreur peut être ignorée si l'enum n'existe pas encore


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_object=include_object,  # Ajout du filtre
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        # Configurer le contexte avec les bonnes options
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_object=include_object,  # Ajout du filtre
        )
        
        # Mettre à jour l'enum avant la migration
        upgrade_enum()
        
        with context.begin_transaction():
            context.run_migrations()


def include_object(object, name, type_, reflected, compare_to):
    """
    Filtre pour inclure/exclure certains objets de la migration.
    Évite les problèmes avec les enums PostgreSQL.
    """
    # Exclure les types enum générés automatiquement pour éviter les conflits
    if type_ == 'type' and name == 'userrole':
        return False
    return True


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()