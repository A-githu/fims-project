import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.user import User

async def check_hash():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == 'supervisor@fims.cm'))
        user = result.scalar_one_or_none()
        if user:
            print(f"Password hash: {user.password_hash}")
        else:
            print("User not found.")

asyncio.run(check_hash())
