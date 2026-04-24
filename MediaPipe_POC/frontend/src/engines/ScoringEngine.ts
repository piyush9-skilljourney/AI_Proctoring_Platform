/**
 * ScoringEngine
 * Converts raw neural outputs into stable, human-readable behavioral scores.
 */
export class ScoringEngine {
  private smoothedScores: number[] = new Array(7).fill(0.5); // Initial neutral baseline
  private readonly ALPHA = 0.15; // Smoothing factor (Higher = faster reaction, lower = smoother)

  /**
   * Processes raw neural outputs and returns smoothed behavioral metrics.
   * @param rawOutputs Array of 7 probabilities from the NeuralEngine.
   */
  process(rawOutputs: number[]) {
    // 1. Exponential Moving Average (EMA) Smoothing
    // This prevents "flickering" alerts from eye blinks or noise.
    this.smoothedScores = rawOutputs.map((val, i) => {
      return (val * this.ALPHA) + (this.smoothedScores[i] * (1 - this.ALPHA));
    });

    // 2. Calculate Derived Integrity Metrics
    // We map raw emotions to proctoring concepts.
    const stressIndex = this.calculateStress();
    const engagementIndex = this.calculateEngagement();

    return {
      scores: this.smoothedScores,
      stressIndex,
      engagementIndex,
      primaryState: this.getPrimaryState()
    };
  }

  /**
   * Logic: Stress is a combination of High Anxiety (Fear) and sustained Neutral-Frowns.
   */
  private calculateStress(): number {
    // Let's assume indices: 0:Neutral, 4:Fear (Anxiety), 3:Angry
    const anxiety = this.smoothedScores[4] || 0;
    const intensity = this.smoothedScores[3] || 0;
    
    let score = (anxiety * 0.7) + (intensity * 0.3);
    return Math.round(score * 100);
  }

  /**
   * Logic: Engagement is high when Neutral/Focused is stable.
   */
  private calculateEngagement(): number {
    const neutral = this.smoothedScores[0] || 0;
    const happy = this.smoothedScores[1] || 0; // "Aha!" moments are engaging
    
    let score = (neutral * 0.8) + (happy * 0.2);
    return Math.round(score * 100);
  }

  private getPrimaryState(): string {
    const states = ["Neutral", "Happy", "Sad", "Angry", "Fear", "Disgust", "Surprise"];
    const maxIdx = this.smoothedScores.indexOf(Math.max(...this.smoothedScores));
    return states[maxIdx];
  }
}
