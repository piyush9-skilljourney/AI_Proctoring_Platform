from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List
import uuid
import json
import os

app = FastAPI(title="HyrAI Proctoring API")

# Setup CORS to allow Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Configuration
MONGO_DETAILS = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_DETAILS)
database = client.hyrai_db
session_collection = database.get_collection("sessions")

class StartSessionRequest(BaseModel):
    candidate_name: str = "Anonymous Candidate"

class StartSessionRespond(BaseModel):
    session_id: str

@app.on_event("startup")
async def startup_db_client():
    # Test connection
    try:
        await client.server_info()
        print("Connected to MongoDB successfully!")
    except Exception as e:
        print("Could not connect to MongoDB:", e)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.post("/api/interviews/start", response_model=StartSessionRespond)
async def start_interview(req: StartSessionRequest):
    session_id = str(uuid.uuid4())
    await session_collection.insert_one({
        "session_id": session_id, 
        "candidate_name": req.candidate_name,
        "status": "started", 
        "logs": []
    })
    return {"session_id": session_id}

@app.post("/api/interviews/{session_id}/submit")
async def submit_interview(
    session_id: str,
    video: UploadFile = File(...),
    logsJson: str = Form(...)
):
    try:
        raw_logs = json.loads(logsJson)
        logs = []
        for log in raw_logs:
            ms = log.get("timestamp", 0)
            mins = int(ms // 60000)
            secs = int((ms % 60000) // 1000)
            logs.append({
                "timestamp": f"{mins:02d}:{secs:02d}",
                "type": log.get("type", "UNKNOWN")
            })
    except Exception as e:
        print("Failed parsing logs:", e)
        logs = []

    # Save video locally
    try:
        video_path = os.path.join(os.getcwd(), f"video_{session_id}.webm")
        file_bytes = await video.read()
        with open(video_path, "wb") as f:
             f.write(file_bytes)
    except Exception as e:
        print("Failed saving video locally:", e)
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to save video: {str(e)}")

    # Update Database
    try:
        await session_collection.update_one(
            {"session_id": session_id},
            {"$set": {"status": "submitted", "logs": logs, "video_path": video_path}}
        )
    except Exception as e:
        print("Failed updating database:", e)
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to update session in DB: {str(e)}")
    
    return {
        "message": "Interview submitted successfully", 
        "session_id": session_id,
        "violations_recorded": len(logs)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
