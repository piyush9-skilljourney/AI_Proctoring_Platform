import {
  ObjectDetector,
  FilesetResolver,
  type ObjectDetectorResult
} from "@mediapipe/tasks-vision";

export interface ObjectDetectionResults {
  detectedItems: string[];
  isProhibited: boolean;
  message: string;
}

export class ObjectEngine {
  private detector: ObjectDetector | null = null;
  private isLoaded = false;
  private prohibitedLabels = ["cell phone", "laptop"];
  private detectionHistory: Record<string, number> = {};

  async initialize() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "/wasm"
      );

      this.detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `/models/efficientdet_lite0.tflite`,
          delegate: "CPU" // Fallback to CPU for stability during debug
        },
        runningMode: "VIDEO",
        scoreThreshold: 0.1,
        maxResults: 10
      });

      console.log("✅ Object Detector Loaded Successfully");
      this.isLoaded = true;
    } catch (error) {
      console.error("ObjectEngine initialization failed:", error);
      throw error;
    }
  }

  detect(videoElement: HTMLVideoElement, timestamp: number): ObjectDetectionResults {
    if (!this.detector || !this.isLoaded) {
      if (Math.random() < 0.01) console.warn("ObjectEngine not ready or detector null");
      return { detectedItems: [], isProhibited: false, message: "Object Engine Initializing..." };
    }

    try {
      const result = this.detector.detectForVideo(videoElement, timestamp);
      return this.processResult(result);
    } catch (e) {
      console.error("Detection Loop Crash:", e);
      return { detectedItems: [], isProhibited: false, message: "Detection Error" };
    }
  }

  private processResult(result: ObjectDetectorResult): ObjectDetectionResults {
    const detections = result.detections || [];
    if (detections.length > 0) {
      console.log("🔍 AI RAW VISION:", detections.map(d => d.categories[0].categoryName));
    } else {
      // Occasional log for empty results
      if (Math.random() < 0.01) console.log("AI SEES NOTHING");
    }
    const items: string[] = [];
    let isProhibited = false;
    let personCount = 0;

    // 1. Identify what is CURRENTLY in the frame
    const currentLabels = new Set<string>();
    detections.forEach(detection => {
      const category = detection.categories[0];
      const label = category?.categoryName;
      const score = category?.score || 0;

      if (label) {
        items.push(label);
        currentLabels.add(label);

        // Track persistence: Increment if seen
        this.detectionHistory[label] = (this.detectionHistory[label] || 0) + 1;
        if (this.detectionHistory[label] > 60) this.detectionHistory[label] = 60;

        // Prohibited Logic (Smart Hallucination Mapping)
        const isPotentialPhone = ["cell phone", "remote", "calculator", "toothbrush"].includes(label);

        if (isPotentialPhone || this.prohibitedLabels.includes(label)) {
          // Lowered threshold to 0.35 to catch modern phones with complex camera modules
          const minConfidence = isPotentialPhone ? 0.35 : 0.2;

          if (score > minConfidence) {
            this.detectionHistory[label] = (this.detectionHistory[label] || 0) + 1;
            const requiredFrames = isPotentialPhone ? 2 : 5;
            if (this.detectionHistory[label] >= requiredFrames) {
              isProhibited = true;
              // If it misclassified as a toothbrush/remote, still report as Phone
              const displayLabel = isPotentialPhone ? "cell phone" : label;
              if (!items.includes(displayLabel)) items.push(displayLabel);
            }
          }
        }

        // Intake Mode Logic (Anti-Hallucination)
        // We require higher confidence (0.5) and 15 frames (~0.5s) for a bottle to be "Real"
        if (["bottle", "cup", "wine glass"].includes(label)) {
          if (score > 0.5 && this.detectionHistory[label] > 15) {
            // Keep it in items
          } else {
            // Filter it out if it's just a flicker
            return;
          }
        }

        // Multi-Person Logic (Extreme Sensitivity)
        if (label === "person" && score > 0.25) {
          personCount++;
        }
      }
    });

    // 2. Temporal Decay: Decrement history for anything NOT in the current frame
    Object.keys(this.detectionHistory).forEach(label => {
      if (!currentLabels.has(label)) {
        this.detectionHistory[label] = Math.max(0, this.detectionHistory[label] - 1); // Slower decay for stability
      }
    });

    let message = "Environment Clear";
    // Only show "Interesting" items in the UI (Ignore chairs, tables, etc.)
    const interestingLabels = ["person", ...this.prohibitedLabels, "bottle", "cup"];
    const displayItems = items.filter(item => interestingLabels.includes(item));

    const prohibitedFound = items.filter(item => this.prohibitedLabels.includes(item));

    if (prohibitedFound.length > 0 && isProhibited) {
      message = `${prohibitedFound[0].toUpperCase()} DETECTED`;
    } else if (personCount > 1) {
      isProhibited = true;
      message = "MULTIPLE PEOPLE DETECTED";
    }

    return {
      detectedItems: displayItems,
      isProhibited,
      message
    };
  }
}
