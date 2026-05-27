import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import update
from app.models.user import User
from app.core.security import hash_password

async def fix_supervisor_pwd():
    async with AsyncSessionLocal() as db:
        new_hash = hash_password("password123")
        await db.execute(
            update(User)
            .where(User.email == "supervisor@fims.cm")
            .values(password_hash=new_hash, failed_login_attempts=0)
        )
        await db.commit()
        print("Password for supervisor@fims.cm updated to 'password123'")

asyncio.run(fix_supervisor_pwd())
