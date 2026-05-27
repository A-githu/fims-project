import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.user import User
from app.core.security import verify_password

async def test_login():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "supervisor@fims.cm"))
        user = result.scalar_one_or_none()
        if not user:
            print("User not found")
            return
        print(f"User found: {user.email}, id: {user.id}")
        print(f"Password hash: {user.password_hash}")
        
        # Test with 'password123' and whatever else could be
        if verify_password("password123", user.password_hash):
            print("Password is password123")
        else:
            print("Password is NOT password123")
            
asyncio.run(test_login())
