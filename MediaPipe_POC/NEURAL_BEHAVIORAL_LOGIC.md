# Neural Behavioral Logic: Master Documentation

This document serves as the "Source of Truth" for how the AI Proctoring Platform interprets human behavior. 

---

## 🏗️ The Architectural Pipeline
Our system follows a 5-step process to convert raw video into an integrity score:

1. **Extraction (MediaPipe)**: Find 478 3D landmarks.
2. **Normalization (DAR)**: Convert raw points into scale-invariant ratios.
3. **Inference (TensorFlow.js)**: Classify ratios into emotional clusters.
4. **Smoothing (EMA)**: Filter out blinks and sensor noise.
5. **Auditing (Suspicion Engine)**: Correlate multiple signals into a final Risk Level.

---

## 🧪 Core Algorithms

### 1. DAR (Distances, Angles, Ratios)
**Problem**: If a candidate moves closer to the camera, raw pixel distances change.
**Solution**: We calculate distances and divide them by a "Face Anchor" (the distance between eyes). 
*   *Math*: $Feature = \frac{Distance(Point A, Point B)}{Distance(Left Eye, Right Eye)}$
*   *Result*: The AI sees the same "Stress" regardless of where the user is sitting.

### 2. EMA (Exponential Moving Average)
**Problem**: AI can be "jittery," changing its mind 30 times a second.
**Solution**: We use a weighted history. 
*   *Formula*: $NewScore = (Current \times 0.1) + (Previous \times 0.9)$
*   *Result*: Stable, professional scores that don't flicker.

### 3. Weighted Suspicion Model
**Problem**: Single signals (like looking away) are not enough to prove cheating.
**Solution**: A weighted mathematical sum of different behaviors.
*   **Weights**: Stress (40%) | Gaze (30%) | Voice (30%).
*   **Thresholds**: 
    *   0.0 - 0.4: **Low Risk** (Normal)
    *   0.4 - 0.7: **Medium Risk** (Suspicious)
    *   0.7 - 1.0: **High Risk** (Critical)

### 4. Baseline Calibration (The "Tare" Algorithm)
**Problem**: Some people have "Resting Stress Face," leading to false positives.
**Solution**: We learn the user's unique baseline in the first 10 seconds (50 samples).
*   *Math*: $ReportedStress = \max(0, CurrentStress - AverageBaseline)$
*   *Result*: We only detect **relative changes** in behavior, making the system fair for all face types.

---

## 🛡️ Security & Performance Hardening

### 1. Backpressure Control
We use an `isProcessingRef` lock. If the AI is still calculating the previous frame, we skip the current frame. This prevents "Lag Spikes" and browser crashes.

### 2. Edge Case: No Face
If landmarks are missing, the system **pauses** scoring. It does not "guess" when the face is gone, preventing false positives from analyzing the background.

### 3. The "No Loophole" Policy
We removed **Intake Mode**. Previously, the AI would ignore talking if it saw a bottle. Now, all behaviors are logged, ensuring that a candidate cannot hide a microphone behind a water bottle.

---

## 📈 Roadmap (Next Steps)
- [ ] **Confidence-Based Weights**: Scale signals by AI confidence.
- [x] **Baseline Calibration**: Learn the user's "Natural Stress" in the first 10 seconds.
- [ ] **Confidence-Based Weights**: Scale signals by AI confidence.
- [ ] **Temporal Pattern Correlation**: Detecting repeated "Look Away -> Stress" sequences.
