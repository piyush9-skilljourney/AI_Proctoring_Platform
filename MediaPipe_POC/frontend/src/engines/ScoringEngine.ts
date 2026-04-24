/**
 * ScoringEngine
 * Converts raw neural outputs into stable, human-readable behavioral scores.
 */
export class ScoringEngine {
  private smoothedScores: number[] = new Array(7).fill(0.5);
  private readonly ALPHA = 0.15;
  
  // Calibration State
  private baselineStress = 0;
  private calibrationSamples: number[] = [];
  private isCalibrated = false;

  /**
   * Processes raw neural outputs and returns smoothed behavioral metrics.
   * @param rawOutputs Array of 7 probabilities from the NeuralEngine.
   */
  process(rawOutputs: number[]) {
    // 1. Exponential Moving Average (EMA) Smoothing
    this.smoothedScores = rawOutputs.map((val, i) => {
      return (val * this.ALPHA) + (this.smoothedScores[i] * (1 - this.ALPHA));
    });
    
    const currentStress = this.calculateStressRaw();

    // 2. Calibration Logic (The "Tare" Weight)
    if (!this.isCalibrated) {
      this.calibrationSamples.push(currentStress);
      // After 30 samples (~3-5 seconds), lock the baseline
      if (this.calibrationSamples.length >= 30) {
        const sum = this.calibrationSamples.reduce((a, b) => a + b, 0);
        this.baselineStress = sum / this.calibrationSamples.length;
        this.isCalibrated = true;
      }
    }

    // 3. Calculate Derived Integrity Metrics
    const finalStress = this.isCalibrated ? Math.max(0, currentStress - this.baselineStress) : currentStress;
    const engagementIndex = this.calculateEngagement();

    return {
      scores: this.smoothedScores,
      stressIndex: Math.round(finalStress * 100),
      engagementIndex,
      primaryState: this.getPrimaryState(),
      isCalibrating: !this.isCalibrated
    };
  }

  private calculateStressRaw(): number {
    const anxiety = this.smoothedScores[4] || 0;
    const intensity = this.smoothedScores[3] || 0;
    return (anxiety * 0.7) + (intensity * 0.3);
  }

  private calculateEngagement(): number {
    const neutral = this.smoothedScores[0] || 0;
    const happy = this.smoothedScores[1] || 0;
    let score = (neutral * 0.8) + (happy * 0.2);
    return Math.round(score * 100);
  }

  private getPrimaryState(): string {
    const states = ["Neutral", "Happy", "Sad", "Angry", "Fear", "Disgust", "Surprise"];
    const maxIdx = this.smoothedScores.indexOf(Math.max(...this.smoothedScores));
    return states[maxIdx];
  }
}
