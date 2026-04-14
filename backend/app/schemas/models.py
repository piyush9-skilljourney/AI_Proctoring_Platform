from pydantic import BaseModel
from typing import List, Optional

class LogEntry(BaseModel):
    timestamp: str
    type: str

class StartSessionRequest(BaseModel):
    candidate_name: str = "Anonymous Candidate"
    session_id: Optional[str] = None

class StartSessionRespond(BaseModel):
    session_id: str

class SessionInfo(BaseModel):
    session_id: str
    candidate_name: str
    status: str
    logs: List[LogEntry]
    video_path: Optional[str] = None
    video_url: Optional[str] = None

class JobPosition(BaseModel):
    id: str
    title: str
    description: str

class Invitation(BaseModel):
    id: str
    candidate_name: str
    candidate_email: str
    job_id: str
    job_type: str
    status: str
    link: str

class JobCreate(BaseModel):
    title: str
    description: str

class InvitationCreate(BaseModel):
    candidate_name: str
    candidate_email: str
    job_id: str
