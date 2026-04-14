from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends, status
from motor.motor_asyncio import AsyncIOMotorClient
from app.schemas.models import StartSessionRequest, StartSessionRespond, SessionInfo, JobPosition, Invitation, JobCreate, InvitationCreate
from app.core.config import settings
from app.core.auth import authenticate_admin, create_access_token, get_current_admin
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
import uuid
import json
import os
import logging
from datetime import datetime

router = APIRouter()

# Setup JSON Logging
logger = logging.getLogger("hyrai_proctoring")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    formatter = logging.Formatter('{"time": "%(asctime)s", "level": "%(levelname)s", "message": %(message)s}')
    ch.setFormatter(formatter)
    logger.addHandler(ch)

# MongoDB Connection
client = AsyncIOMotorClient(settings.MONGO_DETAILS)
db = client[settings.DATABASE_NAME]
session_collection = db.get_collection("sessions")
job_collection = db.get_collection("jobs")
invite_collection = db.get_collection("invitations")

@router.post("/start", response_model=StartSessionRespond)
async def start_interview(req: StartSessionRequest):
    # Use provided session_id (invite_id) or generate a new one
    session_id = req.session_id or str(uuid.uuid4())
    
    session_data = {
        "session_id": session_id, 
        "candidate_name": req.candidate_name,
        "status": "started", 
        "logs": [],
        "created_at": datetime.utcnow()
    }
    
    # Check if session exists (to avoid duplicate inserts if they refresh)
    existing = await session_collection.find_one({"session_id": session_id})
    if not existing:
        await session_collection.insert_one(session_data)
        # Update Invitation status to 'active'
        await invite_collection.update_one(
            {"id": session_id},
            {"$set": {"status": "active"}}
        )
    
    logger.info(json.dumps({
        "event": "session_started",
        "session_id": session_id,
        "candidate": req.candidate_name
    }))
    
    return {"session_id": session_id}

@router.post("/{session_id}/submit")
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
        logger.error(json.dumps({"event": "log_parse_failed", "session_id": session_id, "error": str(e)}))
        logs = []

    # Ensure upload directory exists
    if not os.path.exists(settings.UPLOAD_DIR):
        os.makedirs(settings.UPLOAD_DIR)

    # Save video
    try:
        filename = f"video_{session_id}.webm"
        video_path = os.path.join(settings.UPLOAD_DIR, filename)
        file_bytes = await video.read()
        with open(video_path, "wb") as f:
             f.write(file_bytes)
    except Exception as e:
        logger.error(json.dumps({"event": "video_save_failed", "session_id": session_id, "error": str(e)}))
        raise HTTPException(status_code=500, detail="Failed to save video.")

        # Update Session
        result = await session_collection.update_one(
            {"session_id": session_id},
            {"$set": {"status": "submitted", "logs": logs, "video_path": video_path, "submitted_at": datetime.utcnow()}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Session not found.")
            
        # Update Invitation status to 'completed'
        await invite_collection.update_one(
            {"id": session_id},
            {"$set": {"status": "completed"}}
        )
    except Exception as e:
        logger.error(json.dumps({"event": "db_update_failed", "session_id": session_id, "error": str(e)}))
        raise HTTPException(status_code=500, detail="Failed to update session or invitation in DB.")
    
    logger.info(json.dumps({
        "event": "session_submitted",
        "session_id": session_id,
        "violations": len(logs)
    }))

    return {
        "message": "Interview submitted successfully", 
        "session_id": session_id,
        "violations_recorded": len(logs)
    }

@router.post("/admin/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_admin(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/sessions", response_model=List[SessionInfo])
async def get_all_sessions(current_user: str = Depends(get_current_admin)):
    sessions = []
    async for session in session_collection.find().sort("created_at", -1):
        session["_id"] = str(session["_id"])
        if session.get("video_path"):
            filename = os.path.basename(session["video_path"])
            session["video_url"] = f"{settings.BACKEND_URL}/evidence/{filename}"
        sessions.append(session)
    return sessions

# --- JOB MANAGEMENT ---

@router.get("/admin/jobs", response_model=List[JobPosition])
async def get_jobs(current_user: str = Depends(get_current_admin)):
    jobs = []
    async for job in job_collection.find():
        job["_id"] = str(job["_id"])
        jobs.append(job)
    return jobs

@router.post("/admin/jobs", response_model=JobPosition)
async def create_job(req: JobCreate, current_user: str = Depends(get_current_admin)):
    job_id = str(uuid.uuid4())
    job_data = {
        "id": job_id,
        "title": req.title,
        "description": req.description,
        "created_at": datetime.utcnow()
    }
    await job_collection.insert_one(job_data)
    return job_data

@router.delete("/admin/jobs/{job_id}")
async def delete_job(job_id: str, current_user: str = Depends(get_current_admin)):
    result = await job_collection.delete_one({"id": job_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted"}

# --- INVITATIONS ---

@router.get("/admin/interviews", response_model=List[Invitation])
async def get_invitations(current_user: str = Depends(get_current_admin)):
    invites = []
    try:
        async for invite in invite_collection.find().sort("created_at", -1):
            invite["_id"] = str(invite["_id"])
            
            # Robust mapping for legacy or inconsistent data
            uid = str(invite.get("id") or invite.get("invite_id") or invite["_id"])
            name = invite.get("candidate_name") or "Unknown"
            email = invite.get("candidate_email") or "N/A"
            job_id = str(invite.get("job_id") or "")
            job_type = invite.get("job_type") or invite.get("job_title") or "Unknown Position"
            status = invite.get("status") or "pending"
            
            # Reconstruct link if missing from DB
            link = invite.get("link")
            if not link:
                from urllib.parse import quote
                encoded_name = quote(name)
                link = f"{settings.FRONTEND_URL}/interview?session_id={uid}&name={encoded_name}"
            
            invites.append({
                "id": uid,
                "candidate_name": name,
                "candidate_email": email,
                "job_id": job_id,
                "job_type": job_type,
                "status": status,
                "link": link
            })
    except Exception as e:
        logger.error(f"Error fetching invitations: {str(e)}")
    return invites

@router.post("/admin/interviews/create", response_model=Invitation)
async def create_invitation(req: InvitationCreate, current_user: str = Depends(get_current_admin)):
    # Find job title
    job = await job_collection.find_one({"id": req.job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    invite_id = str(uuid.uuid4())
    from urllib.parse import quote
    encoded_name = quote(req.candidate_name)
    invite_link = f"{settings.FRONTEND_URL}/interview?session_id={invite_id}&name={encoded_name}"
    
    invite_data = {
        "id": invite_id,
        "candidate_name": req.candidate_name,
        "candidate_email": req.candidate_email,
        "job_id": req.job_id,
        "job_type": job["title"],
        "status": "pending",
        "link": invite_link,
        "created_at": datetime.utcnow()
    }
    await invite_collection.insert_one(invite_data)
    
    logger.info(json.dumps({
        "event": "invitation_created",
        "candidate": req.candidate_name,
        "job": job["title"]
    }))
    
    return invite_data
