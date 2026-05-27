import asyncio
from app.core.security import verify_password, hash_password

async def test_hash():
    db_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYv3Z.qZq5gy"
    print(f"Verifying 'password123' against DB hash: {verify_password('password123', db_hash)}")
    
    new_hash = hash_password('password123')
    print(f"New hash for 'password123': {new_hash}")
    print(f"Verifying 'password123' against new hash: {verify_password('password123', new_hash)}")

asyncio.run(test_hash())
