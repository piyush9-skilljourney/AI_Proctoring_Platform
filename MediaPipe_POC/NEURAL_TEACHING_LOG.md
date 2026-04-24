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

### Phase 3: The Inference Loop (HARDENED)
- **Concept**: Backpressure Control (`isProcessingRef`).
- **Lesson**: We must skip frames if the GPU is busy. This prevents the browser from lagging on low-end devices.
- **Solution**: A "Busy Signal" lock that ensures only one AI calculation runs at a time.

### Phase 4: Scoring & Heuristics (HARDENED)
- **Concept**: Temporal Stability & Thresholds.
- **Lesson**: Raw AI data is "jittery." EMA smoothing + minimum activation durations prevent alert spam.

### Phase 5: The Suspicion Engine (UPGRADED)
- **Concept**: Weighted Mathematical Modeling.
- **Lesson**: Instead of simple rules, we use a weighted sum `(Stress*0.4 + Gaze*0.3 + Voice*0.3)`. 
- **Explainability**: We attach **Reason Codes** (e.g., `VOCAL_STRESS_SYNC`) so recruiters know exactly *why* a flag was raised.

### Phase 6: Telemetry UI
- **Concept**: Real-time Data Visualization.
- **Goal**: Adding live risk-bars and "Neural Heartbeat" indicators to the proctoring dashboard.

### Phase 7: Edge Case Handling (COMPLETED)
- **Concept**: Graceful Degradation.
- **Lesson**: AI should not "guess" when data is missing.
- **Solution**: If the face is not detected or lighting is too low, we **pause** the neural engine to avoid false positives.

---

> [!NOTE]
> **Partner Insight**: The transition from Rule-based (v1) to Weighted-Math (v2) was a critical architecture shift that ensures this system can scale to thousands of users without constant manual tuning.
