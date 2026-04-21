import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult
} from "@mediapipe/tasks-vision";

export interface DetectionResults {
  gaze: { x: number; y: number };
  headPose: { pitch: number; yaw: number; roll: number };
  iris: {
    left: { x: number; y: number };
    right: { x: number; y: number };
  };
  isAlert: boolean;
  message: string;
}

export class FaceEngine {
  private landmarker: FaceLandmarker | null = null;
  private isLoaded = false;

  async initialize() {
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "/wasm"
      );

      this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `/models/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });

      this.isLoaded = true;
    } catch (error) {
      console.error("FaceEngine initialization failed:", error);
      throw error;
    }
  }

  detect(videoElement: HTMLVideoElement, timestamp: number): DetectionResults {
    if (!this.landmarker || !this.isLoaded) {
      return this.defaultResults("Initializing Engine...");
    }

    const result = this.landmarker.detectForVideo(videoElement, timestamp);
    return this.processResult(result);
  }

  private processResult(result: FaceLandmarkerResult): DetectionResults {
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      return this.defaultResults("No face detected", true);
    }

    const landmarks = result.faceLandmarks[0];
    const leftIris = landmarks[468];
    const rightIris = landmarks[473];
    const leftOuter = landmarks[33];
    const leftInner = landmarks[133];
    const rightInner = landmarks[362];
    const rightOuter = landmarks[263];

    const irisLeftX = (leftIris.x - leftInner.x) / (leftOuter.x - leftInner.x);
    const irisRightX = (rightIris.x - rightInner.x) / (rightOuter.x - rightInner.x);

    const blendshapes = result.faceBlendshapes?.[0]?.categories || [];
    const eyeLookInLeft = blendshapes.find(c => c.categoryName === "eyeLookInLeft")?.score || 0;
    const eyeLookOutLeft = blendshapes.find(c => c.categoryName === "eyeLookOutLeft")?.score || 0;
    const eyeLookInRight = blendshapes.find(c => c.categoryName === "eyeLookInRight")?.score || 0;
    const eyeLookOutRight = blendshapes.find(c => c.categoryName === "eyeLookOutRight")?.score || 0;

    const gazeX = (eyeLookOutLeft - eyeLookInLeft + eyeLookInRight - eyeLookOutRight) / 2;

    const matrix = result.facialTransformationMatrixes?.[0]?.data || [];
    const yaw = matrix.length > 0 ? Math.asin(matrix[2]) : 0;
    const pitch = matrix.length > 0 ? Math.atan2(-matrix[6], matrix[10]) : 0;

    let isAlert = false;
    let message = "Candidate Active";

    if (Math.abs(yaw) > 0.35) {
      isAlert = true;
      message = "Looking Away (Head)";
    } else if (Math.abs(pitch) > 0.4) {
      isAlert = true;
      message = "Looking Away (Head)";
    } else if (irisLeftX < 0.2 || irisLeftX > 0.8 || irisRightX < 0.2 || irisRightX > 0.8) {
      isAlert = true;
      message = "Suspicious Eye Movement (Iris)";
    } else if (Math.abs(gazeX) > 0.5) {
      isAlert = true;
      message = "Suspicious Eye Movement (Neural)";
    }

    return {
      gaze: { x: gazeX, y: 0 },
      headPose: { pitch, yaw, roll: 0 },
      iris: {
        left: { x: irisLeftX, y: leftIris.y },
        right: { x: irisRightX, y: rightIris.y }
      },
      isAlert,
      message
    };
  }

  private defaultResults(message: string, isAlert = false): DetectionResults {
    return {
      gaze: { x: 0, y: 0 },
      headPose: { pitch: 0, yaw: 0, roll: 0 },
      iris: {
        left: { x: 0.5, y: 0 },
        right: { x: 0.5, y: 0 }
      },
      isAlert,
      message
    };
  }
}
