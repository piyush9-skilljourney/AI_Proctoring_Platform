# MediaPipe Research & Implementation Strategy

## 1. Research: MediaPipe Vision Solutions (2026)

MediaPipe provides a suite of on-device machine learning solutions that are ideal for real-time web-based proctoring. By moving detection to the client-side (WASM), we reduce server load and improve privacy.

### Core Solutions Identified:
| Solution | Application | Use Case for Proctoring |
|----------|-------------|-------------------------|
| **Face Landmarker** | 478 3D landmarks + Blendshapes | Head pose estimation, Gaze tracking, Emotion detection. |
| **Object Detector** | Bounding box detection | Identifying prohibited devices (Phones, Tablets, Laptops). |
| **Selfie Segmentation** | Human masking | Background audit, detecting multiple people in frame. |
| **Hand Landmarker** | 21 hand landmarks | Detecting suspicious hand reach/typing gestures. |
| **Pose Landmarker** | 33 body landmarks | Identifying unauthorized persons standing behind the candidate. |

---

## 2. Implementation Rationale: Why Extension-less?

The current trend in secure assessments is to minimizefriction. Traditional browser extensions are often blocked by corporate/educational IT policies.

### Advantages:
- **Zero Friction**: No installation required; works on any Chromium-based browser via standard APIs.
- **Improved Performance**: MediaPipe Tasks utilize GPU acceleration (WebGL/WebGPU) directly in the browser.
- **Privacy**: Processing happens on the candidate's machine; only metadata and violations are sent to the server.

### Technical Enablers:
- **`getDisplayMedia`**: Native screen capture for multi-display and tab auditing.
- **`FilesetResolver`**: Efficient loading of MediaPipe WASM bundles.

---

## 3. Implementation Steps (Planned)

### Phase 1: Face Landmarking (Current)
**Goal**: Detect if the user is looking away or at a secondary device.
- **Logic**: Use `faceLandmarker.detectForVideo()` results.
- **Heuristics**:
    - `Gaze Deviation`: Measure iris position relative to eye corners.
    - `Head Pose`: Calculate Euler angles (pitch, yaw, roll) from face landmarks.

### Phase 1.5: Eyeball Tracking (Iris)
**Goal**: Increase gaze precision beyond general blendshapes.
- **Logic**: Track MediaPipe Iris landmarks (468-477).
- **Implementation**: Calculate the relative horizontal position of the iris center (468/473) between the inner and outer eye corners.
- **Metric**: 0.5 is centered; values near 0 (inner) or 1 (outer) indicate extreme gaze deviation.

### Phase 2: Object Detection (Prohibited Items) - ✅ Complete
**Goal**: Block access if a mobile phone or prohibited item is visible.
- **Logic**: `objectDetector.detectForVideo()` filtering for labels: `cell phone`, `laptop`, `book`.
- **Polish**: Specific logging (e.g., "LAPTOP DETECTED") implemented.

### Phase 3: Screen Monitoring
**Goal**: Ensure only the exam tab is visible and no duplicate displays are active.
- **Logic**: Combining `getDisplayMedia` with `window.screen` metadata.

---

## 4. Use Case Scenarios

1. **Gaze Mismatch**: Candidate looks at a cheat sheet placed next to the monitor. *Detection: High Yaw deviation.*
2. **External Assistant**: Another person is visible in the background. *Detection: Multi-person count via Selfie Segmentation/Object Detection.*
3. **Mobile Cheating**: Candidate is using a phone below the desk. *Detection: Object Detector (phone) or Hand Pose anomalies.*
