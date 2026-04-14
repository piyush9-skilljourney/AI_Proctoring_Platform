# HyrAI: The Future of Secure AI Proctoring
## Executive Summary & Technical Pitch

**Author:** AI Proctoring Engineering Team  
**Product:** HyrAI (v2.5)  
**Core Mission:** To eliminate technical cheating in remote interviews through multi-layered neural and hardware auditing.

---

## 1. The Value Proposition

In the current remote-hiring landscape, **technical integrity** is the biggest challenge. Standard proctoring tools focus on basic face-tracking, but they fail to catch sophisticated cheaters who use:
*   **Duplicate Displays**: Mirroring the screen to an accomplice in another room.
*   **External Peripherals**: Using hidden mice or keyboards for assistance.
*   **Prompt Engineering**: Looking away at hidden tablets or phones.

**HyrAI** solves this by moving beyond simple "Face-in-frame" detection. We audit the **entire hardware stack** of the candidate, creating an environment where cheating is physically impossible without detection.

---

## 2. Core Capabilities (What we built)

### 🧠 Neural Audit Engine
*   **Sub-Millisecond Face Detection**: Uses MediaPipe to track unique face landmarks in real-time.
*   **Gaze & Head-Pose Logic**: Detects when a candidate turns their head or even shifts their eyeballs toward a hidden cheat sheet.
*   **AI Object Detection**: Active monitoring for smartphones, earpieces, or additional persons in the background.

### 🛡️ Hardware Security (The "HyrAI Guard")
*   **EDID Name Analysis**: The only system that detects mirroring by analyzing the **hardware factory name** of the display (detecting "Generic PnP" HDMI connections even when the OS hides them).
*   **Audio Peripheral Audit**: detects HDMI/DisplayPort audio passthroughs used by external monitors.
*   **Peripheral Lockdown**: Monitors for unauthorized mice, pens, or touch events.
*   **Edge-Detection AI**: Hardened neural model to detect partially visible phones, corners, or backside orientations.
*   **Focus Guard**: Immediate detection of tab-switching, app-blurring, or loss of fullscreen mode.

### 📊 Recruiter Command Center
*   **JWT-Protected Admin Suite**: A premium, glassmorphism-inspired UI for hiring managers.
*   **Job & Invitation Engine**: Create unique, secure interview links for specific positions.
*   **Violation Logging**: Frame-by-frame evidence logs with timestamped violation types (e.g., "Phone Detected at 02:45").

---

## 3. Technical Architecture (How it's made)

### Frontend (React + Vite + MediaPipe)
*   **High Performance**: Minimal latency using WebAssembly (WASM) for on-device AI processing.
*   **Responsive Security**: Real-time integration with browser Window Management and Pointer APIs.
*   **Premium Graphics**: Modern Glassmorphic CSS system for a sleek, enterprise feel.

### Backend (FastAPI + MongoDB)
*   **Asynchronous Core**: Python FastAPI handles high-concurrency for concurrent interview sessions.
*   **NoSQL Flexibility**: MongoDB stores complex violation logs and session metadata.
*   **Secure Auth**: OAuth2 with JWT (JSON Web Tokens) for recruiter dashboard protection.

### Extension (Chrome MV3)
*   **Privileged Info**: Uses `chrome.system.display` to bypass standard browser limitations and audit the physical hardware driver of the candidate's machine.

---

## 4. The Security Heuristics (Our Competitive Edge)

Our system uses a **Consensus Model** for display security:
1.  **Logical Check**: Browser API checks for basic extended desktops.
2.  **Hardware Audit**: Chrome Extension queries the physical monitor count.
3.  **Name Signature**: The system analyzes the EDID string (e.g., catching "Samsung TV" even if it claims to be an "Internal Display").
4.  **Discrepancy Trigger**: If Hardware Count > Logical Count, the system triggers a **"Duplicate Display Blocker"**.

---

## 5. Deployment Simplicity (Handover Ready)

We have built HyrAI with a **"Zero-Configuration"** philosophy for the pitch:
*   **Containerized Environment**: The entire stack is bundled in Docker. You can deploy to any Linux/Windows server with a single command.
*   **Environment Aware**: The system automatically adapts its security heuristics based on the server environment.
*   **Administrator Guide**: A dedicated **DEPLOYMENT_GUIDE.md** is included for the management team to handle handovers without technical friction.

---

## 6. Future Roadmap (Beyond MVP)

To transform HyrAI into a global market leader, we suggest the following phases:

### Phase 1: AI Precision & Behavioral Biometrics
*   **Voice Fingerprinting**: Detect if the candidate's voice profile changes or if a "whispering tutor" is detected in the audio track.
*   **Keystroke Dynamics**: Analyze typing patterns to ensure the candidate is genuinely typing their own code responses.

### Phase 2: Live Intervention
*   **Real-time Admin Notifications**: Instantly alert a live recruiter via WebSocket when a High-Risk violation (Phone/Multiple Faces) occurs.
*   **Remote Termination**: Allow admins to kill a session remotely from the Command Center if blatant cheating is caught.

### Phase 3: Integration & Scale
*   **LMS/ATS Integration**: Plugin support for Greenhouse, Lever, or Workday.
*   **Cloud Video Processing**: Automatic AI re-scanning of uploaded recordings for double-verification.

---

### Conclusion
HyrAI is not just a proctoring tool; it is a **hardware-integrated security protocol**. By combining neural tracking with low-level device auditing, we offer a level of trust that current industry standards cannot match.

---
*End of Report*
