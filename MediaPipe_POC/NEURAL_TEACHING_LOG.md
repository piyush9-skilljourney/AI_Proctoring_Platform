# AI Proctoring: Neural Teaching Log

This file tracks our architectural decisions, technical "lessons," and the roadmap for the Neural Behavioral Audit system.

## 🎓 Completed Lessons

### Phase 1: Infrastructure & Engine
- **Concept**: GPU Acceleration (WebGL/WebGPU).
- **Lesson**: We use TensorFlow.js to move heavy math from the CPU to the GPU.
- **Key Code**: `tf.tidy()` — Manual memory management for the GPU to prevent browser crashes.
- **Key Code**: `warmup()` — Running a fake "zero-tensor" to initialize the GPU pipeline and avoid first-frame lag.

### Phase 2: Feature Engineering (DAR)
- **Concept**: Pose Invariance.
- **Lesson**: Using raw $(x, y)$ coordinates is dangerous because the numbers change when the user moves.
- **Solution**: **DAR (Distances, Angles, Ratios)**. We divide every measurement by the eye-to-eye distance (The Anchor). This makes the AI "distance-blind."

### Phase 3: The Inference Loop
- **Concept**: Throttled Inference.
- **Lesson**: Humans don't change emotions 60 times a second. Running AI every frame wastes battery.
- **Solution**: A `frameCount` based throttle that triggers the AI every 6 frames (~5Hz).

---

## 🚀 Upcoming Lessons (Roadmap)

### Phase 4: Scoring & Heuristics (COMPLETED)
- **Concept**: Signal Smoothing (EMA).
- **Lesson**: Raw AI data is "jittery." We use the formula `(New * 0.1) + (Old * 0.9)` to ignore blinks and noise.
- **Derived Metrics**: We now calculate **Stress Score** and **Engagement Index** based on emotional clusters.

### Phase 5: The Suspicion Engine (NEXT)
- **Concept**: Multi-Signal Correlation.
- **Goal**: Combining Gaze + Stress + Environment signals to identify high-risk cheating patterns.

### Phase 6: Telemetry UI
- **Concept**: Real-time Data Visualization.
- **Goal**: Adding live risk-bars and "Neural Heartbeat" indicators to the proctoring dashboard.

### Phase 7: Explainability & Logs
- **Concept**: Reason Codes.
- **Goal**: Attaching human-readable labels (e.g., `GAZE_STRESS_SYNC`) to alerts for recruiter auditability.
