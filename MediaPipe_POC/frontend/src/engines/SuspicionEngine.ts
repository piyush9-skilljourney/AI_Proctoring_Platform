/**
 * SuspicionEngine (v2.0)
 * Uses a weighted scoring model for high-precision auditing.
 */
export class SuspicionEngine {
  private readonly WEIGHTS = {
    STRESS: 0.4,
    GAZE: 0.3,
    VOICE: 0.3
  };

  private readonly THRESHOLDS = {
    HIGH: 0.7,
    MEDIUM: 0.4
  };

  /**
   * Evaluates signals using a weighted sum.
   */
  evaluate(data: {
    stressScore: number; // 0-100
    gazeAway: boolean;
    objectsDetected: boolean;
    isTalking: boolean;
  }) {
    const reasons: string[] = [];
    
    // 1. Calculate weighted sum
    const stressPart = (data.stressScore / 100) * this.WEIGHTS.STRESS;
    const gazePart = (data.gazeAway ? 1 : 0) * this.WEIGHTS.GAZE;
    const voicePart = (data.isTalking ? 1 : 0) * this.WEIGHTS.VOICE;

    let suspicionScore = stressPart + gazePart + voicePart;

    // 2. Add "Hard Violations" (e.g. prohibited objects)
    if (data.objectsDetected) {
      suspicionScore = 1.0; // Instant High Risk
      reasons.push('PROHIBITED_OBJECT');
    }

    // 3. Generate Explainability Codes
    if (data.gazeAway && data.stressScore > 50) reasons.push('GAZE_STRESS_SYNC');
    if (data.isTalking && data.stressScore > 60) reasons.push('VOCAL_STRESS_SYNC');

    // 4. Map to Risk Levels
    let level: 'low' | 'medium' | 'high' = 'low';
    if (suspicionScore >= this.THRESHOLDS.HIGH) level = 'high';
    else if (suspicionScore >= this.THRESHOLDS.MEDIUM) level = 'medium';

    return {
      level,
      score: suspicionScore,
      reasons
    };
  }
}
