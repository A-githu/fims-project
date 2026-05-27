import asyncio
from app.core.security import verify_password

async def test_guesses():
    db_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYv3Z.qZq5gy"
    guesses = ["password", "supervisor", "supervisor123", "admin", "123456", "12345678", "password1234"]
    for g in guesses:
        if verify_password(g, db_hash):
            print(f"Found it! The password is: {g}")
            return
    print("None of the guesses matched.")

asyncio.run(test_guesses())
