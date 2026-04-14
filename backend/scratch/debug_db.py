import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

async def debug():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["hyrai_db"]
    job_collection = db["jobs"]
    invite_collection = db["invitations"]
    
    print("--- JOBS ---")
    async for job in job_collection.find():
        print(job)
        
    print("\n--- INVITATIONS ---")
    async for inv in invite_collection.find():
        print(inv)

if __name__ == "__main__":
    asyncio.run(debug())
