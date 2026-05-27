import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.user import User

async def list_users():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(f"ID: {u.id}, Email: {u.email}, Role: {u.role}, Active: {u.is_active}, Failed: {u.failed_login_attempts}")

asyncio.run(list_users())
