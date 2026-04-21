# AI Proctoring Platform — POC Project Context (MediaPipe)

## Project Overview
- Name: MediaPipe POC (Extension-less)
- Type: Secure Interview Monitoring System (Proof of Concept)
- Frontend: React / Vite
- Backend: FastAPI
- Database: MongoDB (hyrai_poc_db)
- Realtime: WebRTC + MediaPipe Tasks
- Started: 2026-04-21

---

## Architecture Summary
- Backend Structure:
  - backend/
    - main.py (Single-file fast start for POC)
- Frontend Structure:
  - frontend/
    - src/
      - engines/ (MediaPipe logic)
      - components/
- Database: MongoDB (hyrai_poc_db)
- Detection System:
  - MediaPipe Face Landmarker (Head Pose & Gaze)
  - MediaPipe Object Detector (Phone Detection)
  - Native Screen Capture API (getDisplayMedia)

---

## Modules

| Module | Description | Status |
|--------|------------|--------|
| Base Foundation | Backend/Frontend Setup | ✏️ In Progress |
| Face Landmarking | Eye tracking & Gaze | ⏳ Pending |
| Object Detection | Phone detection | ⏳ Pending |
| Screen Audit | Window monitoring | ⏳ Pending |

---

## File Registry

| # | File Path | Type | Status | Description |
|---|-----------|------|--------|-------------|
| 1 | [PROJECT_CONTEXT.md](file:///d:/Projects/FastAPI/Live Ai proctoring/AI_Proctoring_Platform/MediaPipe_POC/PROJECT_CONTEXT.md) | Docs | ✅ Created | Project tracking |
| 2 | [RESEARCH_AND_IMPLEMENTATION.md](file:///d:/Projects/FastAPI/Live Ai proctoring/AI_Proctoring_Platform/MediaPipe_POC/RESEARCH_AND_IMPLEMENTATION.md) | Docs | ⏳ Pending | Research & Use Cases |

---

## Change Log

| Step | Action | File | Details |
|------|--------|------|---------|
| Step-1 | Create | MediaPipe_POC | Initial POC directory creation. |
| Step-2 | Create | [PROJECT_CONTEXT.md](file:///d:/Projects/FastAPI/Live Ai proctoring/AI_Proctoring_Platform/MediaPipe_POC/PROJECT_CONTEXT.md) | Initialized POC tracking. |

---

## Integration Notes

### MongoDB
- Database: `hyrai_poc_db`
- Strategy: Isolated collections for POC logs.

### MediaPipe
- Using `@mediapipe/tasks-vision` for all neural audits.
- No extension dependency.
