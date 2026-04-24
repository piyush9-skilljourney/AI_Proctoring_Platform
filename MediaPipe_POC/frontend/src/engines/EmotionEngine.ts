import { type Category } from "@mediapipe/tasks-vision";

export interface EmotionResults {
  isTalking: boolean;
  isSurprised: boolean;
  isAnxious: boolean;
  anomalyScore: number;
  state: string;
}

export class EmotionEngine {
  private emaAlpha = 0.2;
  private smoothedValues: Record<string, number> = {};
  private jawHistory: number[] = []; // Buffer for rhythm analysis

  private THRESHOLDS = {
    TALK_JAW: 0.12,
    SURPRISE_EYE: 0.4,
    STRESS_BROW: 0.3,
    YAWN_DURATION_FRAMES: 35, // ~1s of sustained opening
  };

  process(blendshapes: Category[]): EmotionResults {
    // 1. Smooth the raw data
    blendshapes.forEach(b => {
      const prev = this.smoothedValues[b.categoryName] || 0;
      this.smoothedValues[b.categoryName] = prev + this.emaAlpha * (b.score - prev);
    });

    // 2. Extract key metrics (Temporal Buffer)
    const jawOpen = this.smoothedValues["jawOpen"] || 0;
    this.jawHistory.push(jawOpen);
    if (this.jawHistory.length > 60) this.jawHistory.shift();

    const mouthLowerDown = this.smoothedValues["mouthLowerDownLeft"] || 0;
    const eyeWide = Math.max(this.smoothedValues["eyeWideLeft"] || 0, this.smoothedValues["eyeWideRight"] || 0);
    const browInnerUp = this.smoothedValues["browInnerUp"] || 0;
    const browDown = Math.max(this.smoothedValues["browDownLeft"] || 0, this.smoothedValues["browDownRight"] || 0);

    // 3. Rhythmic Behavioral Logic (Ignore Yawns / Sneezes)
    const activeFrames = this.jawHistory.filter(v => v > this.THRESHOLDS.TALK_JAW).length;
    const isYawning = activeFrames > this.THRESHOLDS.YAWN_DURATION_FRAMES; // Sustained open = yawn

    // Talking is rapid fluctuation. We look for a balance of open/closed frames.
    const isTalking = (activeFrames > 5 && activeFrames < 25) && !isYawning;

    const isSurprised = eyeWide > this.THRESHOLDS.SURPRISE_EYE;
    const isAnxious = browInnerUp > this.THRESHOLDS.STRESS_BROW && browDown < 0.2;

    // 4. Calculate Anomaly Score
    let score = 0;
    if (isTalking) score += 40;
    if (isSurprised) score += 30;
    if (isAnxious) score += 20;

    score = Math.min(score, 100);

    let state = "Neutral / Focused";
    if (isYawning) state = "🥱 Yawning (Benign)";
    else if (isTalking) state = "Talking / Whispering";
    else if (isSurprised) state = "Peripheral Alert";
    else if (isAnxious) state = "Distressed";

    return {
      isTalking,
      isSurprised,
      isAnxious,
      anomalyScore: score,
      state
    };
  }
}
