# HyrAI Proctoring: Secure AI-Driven Interview Intelligence

## 1. Vision
HyrAI is a professional-grade proctoring solution designed to ensure integrity and fairness in remote technical assessments. By combining real-time AI computer vision with deep hardware-level auditing, HyrAI eliminates most common cheating vectors while maintaining a seamless candidate experience.

## 2. Core Capabilities

### 🧠 Multi-Model AI Engine
- **Identity Verification**: Real-time face detection ensures only the authorized candidate remains in frame.
- **Behavioral Analysis**: Detects head orientation and eye gaze deviations to identify potential use of side-monitors or off-screen cheat sheets.
- **Object Detection**: High-precision detection of unauthorized devices (cell phones) and secondary subjects.

### 🛡️ Hardware-Level Security (HyrAI Guard)
Unlike standard browser-based proctoring, HyrAI utilizes a dedicated Chrome Extension to bypass browser limitations:
- **Continuous Mirror Detection**: Detects HDMI/DisplayPort mirroring even when the OS masks the external display.
- **Hot-Plug Monitoring**: Real-time alerts if an external monitor is connected *during* the session.
- **Hardware Inventory**: Audits external peripherals like mice and pens to prevent unauthorized input.

### 📊 Recruiter Intelligence (Phase 3)
- **Violation Timelines**: Detailed breakdown of every suspicious event with precise timestamps.
- **Admin Dashboard**: Centralized session management with glassmorphism UI for high-fidelity review.
- **Secure Video Replay**: Local/Cloud storage of interview recordings for manual auditing.

## 3. Technical Architecture

- **Frontend**: React (Vite) + Tailwind/Vanilla CSS (Glassmorphism design system).
- **Backend**: FastAPI (Python) with a modular architecture and Pydantic-based configuration.
- **Database**: MongoDB (NoSQL) for high-performance session and log storage.
- **Real-time Engine**: MediaPipe (Google) Vision Tasks for browser-side AI inference.
- **Security Link**: Chrome System Display API (Hardware Driver Level).

## 4. Why HyrAI?
- **Zero Latency**: All AI processing happens in the browser, ensuring real-time feedback without server bottlenecks.
- **Deep Security**: Only solution in its class to reliably detect "Duplicate Mode" mirroring via proprietary hardware auditing.
- **Scalable**: Container-ready backend with centralized logging and session management.

---
*Created by Antigravity AI for Secure Interview Environments.*
