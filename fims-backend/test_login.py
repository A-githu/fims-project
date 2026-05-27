import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.user import User
from app.core.security import verify_password

async def test_login(email, password):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"User {email} not found")
            return
        
        print(f"User: {user.email}, Role: {user.role}, Type of role: {type(user.role)}")
        
        if not verify_password(password, user.password_hash):
            print("Password verification failed")
        else:
            print("Password verification passed")
            try:
                role_val = user.role.value
                print(f"Role value: {role_val}")
            except Exception as e:
                print(f"Error accessing user.role.value: {e}")

asyncio.run(test_login("supervisor@fims.cm", "password123"))
