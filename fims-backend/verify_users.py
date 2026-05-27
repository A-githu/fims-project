import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select, func
from app.models.user import User

async def count_users():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(func.count()).select_from(User))
        count = result.scalar()
        print(f"Total users in DB: {count}")

asyncio.run(count_users())
