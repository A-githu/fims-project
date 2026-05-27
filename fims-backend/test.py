import asyncio
import app.models
from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User))
        users = res.scalars().all()
        for u in users:
            print(f"Email: {u.email}, Role: {u.role}, Dept: {u.department}, Dept_ID: {u.department_id}")

if __name__ == "__main__":
    asyncio.run(main())
