"""
Script de création des comptes de test FIMS.
Lance depuis la racine du projet : python create_admin.py
"""
import asyncio
import sys
import os

# Ajouter la racine au path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# IMPORTANT : charger tous les modèles dans le bon ordre avant tout
import app.models  # noqa — charge Department, User, Vehicle, Mission, Inspection, MaintenanceTask

from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.department import Department
from app.core.security import hash_password
from sqlalchemy import select


async def seed_departments(db):
    departments = [
        "Direction Technique Douala",
        "Delegation DLA Centre",
        "Delegation DLA Est",
        "Delegation DLA Ouest",
        "Delegation DLA Nord",
        "Delegation DLA Sud",
        "Exploitation Technique DLA Centre",
        "Exploitation Technique DLA Est",
        "Exploitation Technique DLA Ouest",
        "Exploitation Technique DLA Nord",
        "Exploitation Technique DLA Sud",
        "Support Logistique",
        "PNT-DRD",
        "GTC MT& GBT",
        "Eclairage Public & CTD",
        "IT-support",
        "Patrimoine",
        "CCR",
        "Staff Administratif DRD",
        "QHSE",
        "Legal & Comptabilite",
        "EQUIPE LOURDE",
        "ETUDES & TRAVAUX",
        "STAFF ADMINISTRATIF DCOR"
    ]
    
    created = []
    skipped = []
    
    for dept_name in departments:
        existing_result = await db.execute(select(Department).where(Department.name == dept_name))
        existing_dept = existing_result.scalar_one_or_none()
        
        if existing_dept:
            skipped.append(dept_name)
        else:
            dept = Department(name=dept_name)
            db.add(dept)
            created.append(dept_name)
            
    await db.commit()
    return created, skipped

async def create_test_users(db):
        comptes = [
            {"full_name": "Admin FIMS", "email": "admin@fims.cm", "role": UserRole.admin},
            {"full_name": "Manager Logistique", "email": "manager@fims.cm", "role": UserRole.manager},
            {"full_name": "Agent Dupont", "email": "agent@fims.cm", "role": UserRole.agent},
            {"full_name": "Superviseur Unité", "email": "supervisor@fims.cm", "role": UserRole.unit_supervisor},
        ]

        created = []
        skipped = []

        for compte in comptes:
            existing_result = await db.execute(select(User).where(User.email == compte["email"]))
            existing_user = existing_result.scalar_one_or_none()
            
            if existing_user:
                existing_user.password_hash = hash_password("password123")
                existing_user.failed_login_attempts = 0
                existing_user.is_active = True
                if not existing_user.role:
                    existing_user.role = compte["role"]
                skipped.append(compte["email"])
            else:
                user = User(
                    full_name=compte["full_name"],
                    email=compte["email"],
                    password_hash=hash_password("password123"),
                    role=compte["role"],
                    is_active=True,
                    failed_login_attempts=0,
                )
                db.add(user)
                created.append(compte["email"])

        await db.commit()

        print("\n" + "="*50)
        print("  FIMS — Création des comptes de test")
        print("="*50)

        if created:
            print(f"\n[+] Comptes crees ({len(created)}) :")
            for email in created:
                print(f"   * {email} / password123")

        if skipped:
            print(f"\n[!] Deja existants ({len(skipped)}) :")
            for email in skipped:
                print(f"   * {email} (ignore)")

async def main():
    async with AsyncSessionLocal() as db:
        print("\n" + "="*50)
        print("  FIMS — Initialisation de la base de données")
        print("="*50)

        created_depts, skipped_depts = await seed_departments(db)
        if created_depts:
            print(f"\n[+] Departements crees ({len(created_depts)}) :")
            for dept in created_depts:
                print(f"   * {dept}")
        if skipped_depts:
            print(f"\n[!] Departements deja existants ({len(skipped_depts)})")

        await create_test_users(db)

        print("\n[Roles] :")
        print("   admin@fims.cm   -> Acces total")
        print("   manager@fims.cm -> Gestion parc + validations")
        print("   agent@fims.cm   -> Missions + inspections")
        print("\n[*] Lance l'API : uvicorn app.main:app --reload --port 8000")
        print("[*] Swagger     : http://localhost:8000/docs")
        print("="*50 + "\n")

if __name__ == "__main__":
    asyncio.run(main())