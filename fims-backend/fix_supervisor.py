import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select, update
from app.models.user import User
from app.core.security import hash_password

async def fix_supervisor():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == 'supervisor@fims.cm'))
        user = result.scalar_one_or_none()
        
        if user:
            print("User supervisor@fims.cm found. Updating password and resetting failed attempts...")
            new_hash = hash_password('password123')
            await db.execute(
                update(User).where(User.email == 'supervisor@fims.cm').values(
                    password_hash=new_hash,
                    failed_login_attempts=0
                )
            )
            await db.commit()
            print("Successfully updated supervisor@fims.cm")
        else:
            print("User supervisor@fims.cm not found in DB.")

asyncio.run(fix_supervisor())
