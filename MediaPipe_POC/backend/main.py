import os
import datetime
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load POC environment
load_dotenv()

app = FastAPI(title="MediaPipe POC Backend")

# CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Connection
client = AsyncIOMotorClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017"))
db = client[os.getenv("DATABASE_NAME", "hyrai_poc_db")]

# Schemas
class ViolationLog(BaseModel):
    session_id: str
    type: str  # e.g., "GAZE_DEVIATION", "OBJECT_DETECTED"
    details: str
    timestamp: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class SessionInit(BaseModel):
    candidate_name: str
    assessment_id: str

@app.on_event("startup")
async def startup_db_client():
    print(f"Connected to MongoDB: {os.getenv('DATABASE_NAME')}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.get("/")
async def root():
    return {"status": "MediaPipe POC Backend Running", "db": os.getenv("DATABASE_NAME")}

@app.post("/api/poc/session/start")
async def start_session(session: SessionInit):
    new_session = {
        "candidate_name": session.candidate_name,
        "assessment_id": session.assessment_id,
        "start_time": datetime.datetime.utcnow(),
        "status": "active"
    }
    result = await db.sessions.insert_one(new_session)
    return {"session_id": str(result.inserted_id)}

@app.post("/api/poc/log")
async def log_violation(log: ViolationLog):
    await db.logs.insert_one(log.dict())
    return {"status": "logged"}

@app.get("/api/poc/logs/{session_id}")
async def get_logs(session_id: str):
    cursor = db.logs.find({"session_id": session_id})
    logs = await cursor.to_list(length=100)
    for log in logs:
        log["_id"] = str(log["_id"])
    return logs

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
