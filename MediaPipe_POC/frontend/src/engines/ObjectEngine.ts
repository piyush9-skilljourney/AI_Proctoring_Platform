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
  private prohibitedLabels = ["cell phone", "laptop", "book"];

  async initialize() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "/wasm"
      );

      this.detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `/models/efficientdet_lite0.tflite`,
          delegate: "AUTO"
        },
        runningMode: "VIDEO",
        scoreThreshold: 0.2
      });

      this.isLoaded = true;
    } catch (error) {
      console.error("ObjectEngine initialization failed:", error);
      throw error;
    }
  }

  detect(videoElement: HTMLVideoElement, timestamp: number): ObjectDetectionResults {
    if (!this.detector || !this.isLoaded) {
      return { detectedItems: [], isProhibited: false, message: "Object Engine Initializing..." };
    }

    const result = this.detector.detectForVideo(videoElement, timestamp);
    return this.processResult(result);
  }

  private processResult(result: ObjectDetectorResult): ObjectDetectionResults {
    const detections = result.detections || [];
    const items: string[] = [];
    let isProhibited = false;
    let personCount = 0;

    detections.forEach(detection => {
      const label = detection.categories[0]?.categoryName;
      if (label) {
        items.push(label);
        if (this.prohibitedLabels.includes(label)) {
          isProhibited = true;
        }
        if (label === "person") {
          personCount++;
        }
      }
    });

    let message = "Environment Clear";
    const prohibitedFound = items.filter(item => this.prohibitedLabels.includes(item));
    
    if (prohibitedFound.length > 0) {
      message = `${prohibitedFound[0].toUpperCase()} DETECTED`;
    } else if (personCount > 1) {
      isProhibited = true;
      message = "MULTIPLE PEOPLE DETECTED";
    }

    return {
      detectedItems: items,
      isProhibited,
      message
    };
  }
}
