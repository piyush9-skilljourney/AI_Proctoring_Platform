# AI Proctoring Platform — Project Context & Change Log

## Project Overview
- Name: AI Proctoring Platform (HyrAI)
- Type: Secure Interview Monitoring System
- Frontend: React / Vite
- Backend: FastAPI
- Database: MongoDB (hyrai_db)
- Realtime: WebRTC + MediaPipe
- Started: 2026-04-13

---

## Architecture Summary
- Backend Structure:
  - backend/
    - app/
      - api/ (endpoints.py)
      - core/ (auth.py, config.py)
      - schemas/ (models.py)
- Frontend Structure:
  - src/
    - components/ (Proctoring, Admin, PreCheck)
    - index.css (Premium Design System)
- Database: MongoDB (hyrai_db)
- Recording Format: WebM (saved to backend/uploads/)
- Detection System:
  - Neural Head Pose & Eye Tracking
  - Object Detection (Phone/Person)
  - Display Audit (Window Management API + Extension)
  - Peripheral Monitor (Pointer Events)

---

## Modules

| Module | Description | Status |
|--------|------------|--------|
| Auth | Recruiter JWT Authentication | ✅ Active (v2.5) |
| Interview Session | Start/Stop proctoring | ✅ Active |
| Job Management | Create/Delete positions | ✅ Active |
| Invitations | Issue secure candidate links | ✏️ Troubleshooting |
| Proctoring Engine | Real-time Neural Audit | ✅ Active |
| Recording | Video/audio captures | ✅ Active |
| Recruiter Dashboard | Integrated Control Center | ✅ Active (Premium UI) |

---

## File Registry

| # | File Path | Type | Status | Description |
|---|-----------|------|--------|-------------|
| 1 | [auth.py](file:///d:/Projects/FastAPI/Live Ai proctoring/AI_Proctoring_Platform/backend/app/core/auth.py) | Backend | ✅ Active | JWT Auth Logic |
| 2 | [endpoints.py](file:///d:/Projects/FastAPI/Live Ai proctoring/AI_Proctoring_Platform/backend/app/api/endpoints.py) | Backend | ✏️ Modified | API Routes (Admin/Session) |
| 3 | [models.py](file:///d:/Projects/FastAPI/Live Ai proctoring/AI_Proctoring_Platform/backend/app/schemas/models.py) | Backend | ✅ Active | Pydantic Schemas |
| 4 | [Admin.tsx](file:///d:/Projects/FastAPI/Live Ai proctoring/AI_Proctoring_Platform/src/components/Admin.tsx) | Frontend | ✏️ Modified | Premium Control Center |
| 5 | [Proctoring.tsx](file:///d:/Projects/FastAPI/Live Ai proctoring/AI_Proctoring_Platform/src/components/Proctoring.tsx) | Frontend | ✏️ Modified | Neural Audit Session |
| 6 | [index.css](file:///d:/Projects/FastAPI/Live Ai proctoring/AI_Proctoring_Platform/src/index.css) | Frontend | ✏️ Modified | Global Glassmorphism CSS |

---

## API Endpoint Registry

| Method | Endpoint | File | Description | Status |
|--------|----------|------|-------------|--------|
| POST | `/api/interviews/admin/login` | endpoints.py | Recruiter login (JWT) | ✅ Active |
| GET | `/api/interviews/sessions` | endpoints.py | List all proctored sessions | ✅ Active |
| GET | `/api/interviews/admin/jobs` | endpoints.py | List available positions | ✅ Active |
| POST | `/api/interviews/admin/jobs` | endpoints.py | Create new position | ✅ Active |
| POST | `/api/interviews/admin/interviews/create`| endpoints.py | Generate candidate invitation | ✅ Active |
| POST | `/api/interviews/start` | endpoints.py | Initialize session | ✅ Active |

---

## Database Schema

| Collection | Fields | Description | Status |
|------------|--------|-------------|--------|
| sessions | session_id, candidate_name, logs, video_path | Proctoring results | ✅ Active |
| jobs | id, title, description | Position details | ✅ Active |
| invitations | id, candidate_name, job_id, link, status | Secure invite links | ✅ Active |

---

## Detection Rules Registry (Neural Audit)

| Rule Name | Trigger | Action | Status |
|-----------|--------|--------|--------|
| EYE_TRACKING | Blendshapes (Iris deviation) | AI Alert | ✅ Active |
| HEAD_POSE | Nose/Cheek ratio deviation | AI Alert | ✅ Active |
| PHONE_DETECT | ObjectDetector (cell phone) | AI Alert | ✅ Active |
| DISPLAY_AUDIT | screenDetails.length > 1 | Blocker | ✅ Active |
| FOCUS_LOSS | window.blur / tab switch | AI Alert | ✅ Active |

---

## Change Log

| Step | Action | File | Details |
|------|--------|------|---------|
| Step-6 | Modify | auth.py | Backend: Implemented `create_access_token` for JWT. |
| Step-7 | Modify | models.py | Backend: Added JobPosition and Invitation schemas. |
| Step-8 | Modify | endpoints.py | Backend: Implemented Job/Invitation CRUD and JWT protection. |
| Step-9 | Modify | index.css | Frontend: Implemented Premium Design System (Glassmorphism). |
| Step-10| Modify | Admin.tsx/css | Frontend: Full Control Center overhaul with management features. |
| Step-11| Modify | Proctoring.tsx/css| Frontend: Premium UI Refresh for secure proctoring session. |
| Step-12| Modify | Admin.tsx/endpoints.py| Debugging: Added error alerts and improved invitation data mapping. |
| Step-13| Modify | Proctoring.tsx | Hardening: Implemented hardware-to-software consensus for duplicate display detection. |
| Step-14| Modify | Proctoring.tsx | Restoration: Re-implemented Display Name (EDID) and Audio Peripheral heuristics. |
| Step-15| Create | [product_pitch_report.md](file:///d:/Projects/FastAPI/Live Ai proctoring/AI_Proctoring_Platform/Reports/product_pitch_report.md) | Documentation: Detailed product pitch, architecture overview, and future roadmap. |
| Step-16| Modify | config.py/Admin.tsx | Production Readiness: Moving hardcoded URLs and secrets to environment variables. |
| Step-17| Modify | main.py/Admin.tsx | Evidence Review: Serving proctoring videos and added "Download/Watch" buttons. |
| Step-18| Create | Dockerfile/docker-compose.yml | Portability: Containerizing the full stack for "one-click" deployment. |
| Step-19| Modify | endpoints.py/Admin.tsx | Polish: Implemented invitation status sync and detailed violation logs view. |
| Step-20| Create | DEPLOYMENT_GUIDE.md | Handover: Professional instructions for one-click Docker deployment and AI tuning. |

---

## Integration Notes

### MongoDB
- Connection URI: `mongodb://localhost:27017`
- Database: `hyrai_db`

### Frontend Auth
- JWT stored in `localStorage` as `admin_token`.
- Standard Credentials: `admin` / `admin123`.

---

## Final Summary
- Total Files Created: 4
- Total APIs: 8
- Total DB Collections: 3
- Total Detection Rules: 10 (Advanced Neural Audit)
