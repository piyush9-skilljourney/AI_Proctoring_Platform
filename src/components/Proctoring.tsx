import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, ObjectDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import "./Proctoring.css";

type ProctoringStatus =
  | "LOADING"
  | "GOOD"
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "PHONE_DETECTED"
  | "LOOKING_AWAY"
  | "MULTIPLE_DISPLAYS"
  | "SECURITY_ALERT"
  | "TAB_SWITCH"
  | "DUPLICATE_DISPLAY"
  | "PERIPHERAL_DETECTED"
  | "STRESS_ALERT"
  | "BEHAVIORAL_ANOMALY";

interface NeuralLogEntry {
  timestamp: string;
  event: string;
  details?: string;
}

const USE_EXTENSION_SECURITY = false; // Latent toggle
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/interviews";

const Proctoring = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlSessionId = searchParams.get("session_id");
  const urlName = searchParams.get("name");
  const candidateName = urlName || location.state?.candidateName || "Anonymous Candidate";

  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<ProctoringStatus>("LOADING");
  const [faceCount, setFaceCount] = useState(0);
  const [screenCount, setScreenCount] = useState(1);
  const [isExternalDisplay, setIsExternalDisplay] = useState(false);
  const [pointerType, setPointerType] = useState<string>("unknown");
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null);
  const [emotion, setEmotion] = useState<string>("Neutral");
  const [stressLevel, setStressLevel] = useState(0);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [displayPermission, setDisplayPermission] = useState<boolean>(false);

  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const currentLogsRef = useRef<NeuralLogEntry[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const interviewStartTimeRef = useRef<number>(Date.now());
  const sessionStartedRef = useRef(false);

  // Use refs to avoid stale closures in the requestAnimationFrame loop
  const invalidStartTimeRef = useRef<number | null>(null);
  const currentDisplayStatusRef = useRef<ProctoringStatus>("LOADING");
  const securityViolationRef = useRef<ProctoringStatus | null>(null);
  const mousePosRef = useRef({ x: 0.5, y: 0.5 });
  const emotionHistoryRef = useRef<number[]>([]);
  const highStressStartTimeRef = useRef<number | null>(null);
  const lastLogTimeRef = useRef<number>(0);

  useEffect(() => {
    let faceLandmarker: FaceLandmarker;
    let objectDetector: ObjectDetector;
    let animationFrameId: number;
    let lastVideoTime = -1;
    let isComponentMounted = true;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        // 1. Initialize Face Landmarker
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 5,
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3
        });

        // 2. Initialize Object Detector (for cell phones and hidden bodies)
        objectDetector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          scoreThreshold: 0.3 // Increased sensitivity to catch corners/edges of devices
        });

        if (isComponentMounted) {
          startCamera();
        }
      } catch (error) {
        console.error("Error setting up MediaPipe:", error);
      }
    };

    const startCamera = async () => {
      let retries = 3;
      while (retries > 0 && isComponentMounted) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user"
            },
            audio: true
          });
          if (videoRef.current && isComponentMounted) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);

            try {
              const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
              recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                  recordedChunksRef.current.push(e.data);
                }
              };
              recorder.start(1000);
              mediaRecorderRef.current = recorder;
            } catch (e) {
              const recorder = new MediaRecorder(stream);
              recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                  recordedChunksRef.current.push(e.data);
                }
              };
              recorder.start(1000);
              mediaRecorderRef.current = recorder;
            }
            interviewStartTimeRef.current = Date.now();
            break; // Success! Exit retry loop
          } else {
            // Unmounted while asking for camera
            stream.getTracks().forEach(t => t.stop());
            break;
          }
        } catch (error: any) {
          console.warn(`Camera access failed, retries left: ${retries - 1}`, error);
          retries--;
          if (retries === 0) {
            setDisplayError("Could not access camera. It may be in use by another application or blocked.");
            // Force failure state if camera is missing
            setStatus("NO_FACE");
          } else {
            await new Promise(res => setTimeout(res, 1000)); // wait 1s before retrying
          }
        }
      }
    };

    const predictWebcam = () => {
      if (!isComponentMounted || !videoRef.current || !faceLandmarker || !objectDetector) return;

      const video = videoRef.current;
      const startTimeMs = performance.now();

      if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;

        // Run both models in parallel on the frame
        const faceResults = faceLandmarker.detectForVideo(video, startTimeMs);
        const objResults = objectDetector.detectForVideo(video, startTimeMs);

        let rawStatus: ProctoringStatus = "GOOD";
        let currentFaceCount = 0;
        let personCount = 0;
        let phoneDetected = false;
        let isLookingAway = false;

        // Process Objects (Phones and People Bodies)
        if (objResults.detections) {
          for (const detection of objResults.detections) {
            if (detection.categories && detection.categories.length > 0) {
              const category = detection.categories[0].categoryName;
              if (category === "person") personCount++;
              // Catching phones and objects that look like them (remotes/electronics)
              if (category === "cell phone" || category === "remote") phoneDetected = true;
            }
          }
        }

        // Process Faces
        if (faceResults.faceLandmarks) {
          currentFaceCount = faceResults.faceLandmarks.length;

          if (currentFaceCount === 1) {
            // Check Head Pose using specific mesh nodes
            const face = faceResults.faceLandmarks[0];
            const nose = face[1];
            const leftCheek = face[234];
            const rightCheek = face[454];

            let ratio: number | undefined;

            if (nose && leftCheek && rightCheek) {
              const leftDist = Math.abs(nose.x - leftCheek.x);
              const rightDist = Math.abs(nose.x - rightCheek.x);
              // Calculate ratio between left distance and right distance
              ratio = leftDist / (rightDist + 0.0001);

              if (ratio > 3.0 || ratio < 0.33) {
                isLookingAway = true; // Head turned
              }
            }

            // EYEBALL TRACKING (Pupil/Iris level)
            if (faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0) {
              const blendshapes = faceResults.faceBlendshapes[0].categories;

              const eyeLookOutLeft = blendshapes.find(b => b.categoryName === 'eyeLookOutLeft')?.score || 0;
              const eyeLookInLeft = blendshapes.find(b => b.categoryName === 'eyeLookInLeft')?.score || 0;
              const eyeLookOutRight = blendshapes.find(b => b.categoryName === 'eyeLookOutRight')?.score || 0;
              const eyeLookInRight = blendshapes.find(b => b.categoryName === 'eyeLookInRight')?.score || 0;
              const eyeLookUpLeft = blendshapes.find(b => b.categoryName === 'eyeLookUpLeft')?.score || 0;

              // High confidence thresholds for eye movement while head is still
              const lookingLeftEyes = eyeLookOutLeft > 0.55 && eyeLookInRight > 0.55;
              const lookingRightEyes = eyeLookOutRight > 0.55 && eyeLookInLeft > 0.55;
              const lookingUpEyes = eyeLookUpLeft > 0.60; // looking up at a cheat sheet above camera

              if (lookingLeftEyes || lookingRightEyes || lookingUpEyes) {
                isLookingAway = true; // Eyeballs deviated strongly
              }

              // --- ADVANCED NEURAL EMOTION ENGINE (7-CORE) ---
              const b = (name: string) => blendshapes.find(cat => cat.categoryName === name)?.score || 0;

              const browDown = (b('browDownLeft') + b('browDownRight')) / 2;
              const eyeWide = (b('eyeWideLeft') + b('eyeWideRight')) / 2;
              const mouthPress = (b('mouthPressLeft') + b('mouthPressRight')) / 2;
              const mouthSmile = (b('mouthSmileLeft') + b('mouthSmileRight')) / 2;
              const mouthFrown = (b('mouthFrownLeft') + b('mouthFrownRight')) / 2;
              const jawOpen = b('jawOpen');
              const noseSneer = (b('noseSneerLeft') + b('noseSneerRight')) / 2;
              const browInnerUp = b('browInnerUp');

              let currentEmotion = "Neutral";
              let currentStress = 0;
              let honestyShift = 0;

              // Rule-based classification for 7 basic emotions
              if (mouthSmile > 0.4) {
                currentEmotion = "Happy";
                honestyShift = 5; // Positive engagement
              } else if (eyeWide > 0.4 && jawOpen > 0.3) {
                currentEmotion = "Surprised";
                if (isLookingAway) honestyShift = -15; // Suspicious surprise
              } else if (eyeWide > 0.3 && browInnerUp > 0.3) {
                currentEmotion = "Fear";
                honestyShift = -10; // Anxiety/Guilt signal
              } else if (browDown > 0.4 && mouthPress > 0.3) {
                currentEmotion = "Angry";
                honestyShift = -5; // Frustration
              } else if (mouthFrown > 0.3 || browDown > 0.3) {
                currentEmotion = "Sad";
                honestyShift = -2;
              } else if (noseSneer > 0.3) {
                currentEmotion = "Disgust";
                honestyShift = -5;
              } else {
                currentEmotion = "Focused";
                honestyShift = 2;
              }

              // Honesty Logic: Weighted average of emotional stability
              // In a real app, this would be a more complex temporal model
              currentStress = Math.min(100, Math.round((browDown * 30) + (mouthPress * 30) + (eyeWide * 20) + (isLookingAway ? 20 : 0)));
              
              setEmotion(currentEmotion);
              setStressLevel(currentStress);

              // --- BEHAVIORAL AUDIT ENGINE ---
              const now = performance.now();
              if (now - lastLogTimeRef.current > 10000) {
                 lastLogTimeRef.current = now;
                 currentLogsRef.current.push({
                   timestamp: new Date().toISOString(),
                   event: "BEHAVIORAL_SNAPSHOT",
                   details: JSON.stringify({
                     emotion: currentEmotion,
                     stress: currentStress,
                     integrity_impact: honestyShift,
                     is_looking_away: isLookingAway
                   })
                 });
              }

              // --- STRESS ALERT LOGIC (15s @ 85% threshold) ---
              if (currentStress > 85) {
                 if (highStressStartTimeRef.current === null) highStressStartTimeRef.current = now;
                 if (now - highStressStartTimeRef.current > 15000) {
                    securityViolationRef.current = "STRESS_ALERT";
                 }
              } else if (securityViolationRef.current === "STRESS_ALERT") {
                 securityViolationRef.current = null;
                 highStressStartTimeRef.current = null;
              } else {
                 highStressStartTimeRef.current = null;
              }

              // --- GAZE-CURSOR MISMATCH ---
              const isLookingLeft = lookingLeftEyes || (typeof ratio !== 'undefined' && ratio > 2.5);
              const isLookingRight = lookingRightEyes || (typeof ratio !== 'undefined' && ratio < 0.4);
              const mouseX = mousePosRef.current.x;

              if ((isLookingLeft && mouseX > 0.8) || (isLookingRight && mouseX < 0.2)) {
                if (invalidStartTimeRef.current === null) invalidStartTimeRef.current = performance.now();
                if (performance.now() - (invalidStartTimeRef.current || 0) > 3000) {
                  securityViolationRef.current = "DUPLICATE_DISPLAY";
                }
              } else {
                invalidStartTimeRef.current = null;
              }
            }
          }
        }

        // Aggregate Rule Engine
        // High severity to low severity
        if (securityViolationRef.current) {
          rawStatus = securityViolationRef.current;
        } else if (phoneDetected) {
          rawStatus = "PHONE_DETECTED";
        } else if (currentFaceCount > 1 || personCount > 1) {
          rawStatus = "MULTIPLE_FACES";
        } else if (currentFaceCount === 0) {
          rawStatus = "NO_FACE";
        } else if (isLookingAway) {
          rawStatus = "LOOKING_AWAY";
        }

        // Timer Logic (2-second Grace Period)
        if (rawStatus === "GOOD") {
          invalidStartTimeRef.current = null;
          currentDisplayStatusRef.current = "GOOD";
        } else if (
          rawStatus === "PHONE_DETECTED" ||
          rawStatus === "SECURITY_ALERT" ||
          rawStatus === "MULTIPLE_DISPLAYS" ||
          rawStatus === "TAB_SWITCH" ||
          rawStatus === "DUPLICATE_DISPLAY" ||
          rawStatus === "PERIPHERAL_DETECTED" ||
          rawStatus === "LOOKING_AWAY" // Bypassing timer for urgent eye tracking
        ) {
          // High-severity violations bypass grace timer
          invalidStartTimeRef.current = null;
          currentDisplayStatusRef.current = rawStatus;
        } else {
          if (invalidStartTimeRef.current === null) {
            invalidStartTimeRef.current = startTimeMs;
          } else if (startTimeMs - invalidStartTimeRef.current >= 2000) {
            currentDisplayStatusRef.current = rawStatus;
          }
        }

        setStatus(currentDisplayStatusRef.current);
        setFaceCount(Math.max(currentFaceCount, personCount));
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupMediaPipe();

    // 3. Display / Window Management Security
    const setupDisplaySecurity = async () => {
      try {
        if (!window.isSecureContext) {
          setDisplayError("Enviroment is not secure (requires HTTPS or localhost). Display detection disabled.");
          return;
        }

        // @ts-ignore - Window Management API might not be in types yet
        if ("getScreenDetails" in window || "getScreens" in window) {
          // @ts-ignore
          const screenDetails = await window.getScreenDetails();
          setDisplayPermission(true);
          setDisplayError(null);

          const updateScreens = () => {
            const screens = screenDetails.screens;
            setScreenCount(screens.length);
            const hasExternal = screens.some((s: any) => !s.isInternal);
            setIsExternalDisplay(hasExternal);

            if (screens.length > 1) {
              securityViolationRef.current = "MULTIPLE_DISPLAYS";
            } else {
              // Signal 1: Geometry Anomaly (Loosened for laptops)
              const logicalScreenWidth = window.screen.width;
              const logicalWindowWidth = window.innerWidth;
              // High-DPI laptops often have taskbar offsets > 50px
              if (document.fullscreenElement && Math.abs(logicalScreenWidth - logicalWindowWidth) > 150) {
                securityViolationRef.current = "DUPLICATE_DISPLAY";
              } else if (securityViolationRef.current === "MULTIPLE_DISPLAYS" || securityViolationRef.current === "DUPLICATE_DISPLAY") {
                securityViolationRef.current = null;
              }
            }
          };

          screenDetails.addEventListener("screenschange", updateScreens);
          updateScreens(); // Initial check
        } else {
          // Fallback for browsers without Window Management API
          // We can at least check screen.isExtended
          setDisplayError("Window Management API not supported in this browser. Using limited fallback.");
          // @ts-ignore
          if (window.screen.isExtended) {
            setScreenCount(2);
            securityViolationRef.current = "MULTIPLE_DISPLAYS";
          }
        }
      } catch (err: any) {
        console.warn("Display Security warning:", err);
        if (err.name === 'NotAllowedError') {
          setDisplayError("Permission denied. Click the lock icon in the URL bar 🔒 ➔ Site Settings ➔ Allow 'Window Management', then refresh.");
        } else if (err.name === 'MustBeInActiveDocumentError' || err.message.includes('user gesture')) {
          setDisplayError("Please click 'Enable Display Security' to allow tracking.");
        } else {
          setDisplayError("Failed to access display information: " + err.message);
        }
      }
    };

    // 4. Focus & Pointer Security
    const handleVisibilityChange = () => {
      if (document.hidden) {
        securityViolationRef.current = "TAB_SWITCH";
      }
    };

    const handleBlur = () => {
      securityViolationRef.current = "SECURITY_ALERT";
    };

    const handleFocus = () => {
      // Don't immediately clear alert, let user see it for a bit
      setTimeout(() => {
        if (securityViolationRef.current === "SECURITY_ALERT" || securityViolationRef.current === "TAB_SWITCH") {
          securityViolationRef.current = null;
        }
      }, 3000);
    };

    const handleContextMenu = (e: Event) => e.preventDefault();
    const handleCopyPaste = (e: Event) => {
      e.preventDefault();
      securityViolationRef.current = "SECURITY_ALERT";
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        securityViolationRef.current = "TAB_SWITCH";
      }
    };

    const handlePointerType = (e: PointerEvent) => {
      setPointerType(e.pointerType); // 'mouse', 'pen', 'touch'
      // ALERT: We no longer block for 'mouse' because laptop trackpads identify as 'mouse'.
      // This remains in metadata only.
    };

    // Try to setup immediately, but it might fail without user interaction
    setupDisplaySecurity();

    // Export a function to allow manual triggering if needed
    // @ts-ignore
    window.triggerDisplaySecurity = () => setupDisplaySecurity(true);

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pointerdown", handlePointerType);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("copy", handleCopyPaste);
    window.addEventListener("paste", handleCopyPaste);
    window.addEventListener("mousemove", handleMouseMove);

    // 5. Continuous Native Multi-Signal Scanner
    const nativeScanInterval = setInterval(() => {
      if (!isComponentMounted) return;
      if (USE_EXTENSION_SECURITY) return; // Skip if extension is active

      let totalSignals = 0;
      const logicalScreenWidth = window.screen.width;
      const logicalWindowWidth = window.innerWidth;
      // Signal 1: Geometry (Weighted)
      if (document.fullscreenElement && Math.abs(logicalScreenWidth - logicalWindowWidth) > 150) totalSignals += 1.0;

      navigator.mediaDevices.enumerateDevices().then(devices => {
        // Signal 2: External Audio (Weighted hint)
        const suspiciousBrands = ["samsung", "lg", "dell", "benq", "acer", "asus", "television"];
        const hasExternalAudio = devices.some(d => d.kind === 'audiooutput' && suspiciousBrands.some(brand => d.label.toLowerCase().includes(brand)));
        if (hasExternalAudio) totalSignals += 0.5;

        // Signal 3: Logical Count via Window Management
        // @ts-ignore
        if (window.screen.isExtended) totalSignals += 1.5;

        // Aggregate Consensus (Requires 2.0 for a block)
        if (totalSignals >= 2.0) {
          securityViolationRef.current = "DUPLICATE_DISPLAY";
          setIsExternalDisplay(true);
        } else if (securityViolationRef.current === "DUPLICATE_DISPLAY") {
          // Auto-clear if signals drop below threshold
          securityViolationRef.current = null;
          setIsExternalDisplay(false);
        }
      });
    }, 5000);

    // Latent Extension Polling (STASHED)
    /*
    const extensionPollInterval = setInterval(() => {
      if (!isComponentMounted || !USE_EXTENSION_SECURITY) return;
      // ... extension code ...
    }, 3000);
    */

    return () => {
      isComponentMounted = false;
      clearInterval(nativeScanInterval);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (faceLandmarker) faceLandmarker.close();
      if (objectDetector) objectDetector.close();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pointerdown", handlePointerType);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("copy", handleCopyPaste);
      window.removeEventListener("paste", handleCopyPaste);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    if (status !== "GOOD" && status !== "LOADING") {
      const prev = currentLogsRef.current;
      const lastLog = prev[prev.length - 1];
      const currentTimeOffset = Date.now() - interviewStartTimeRef.current;

      // Deduplication check
      if (lastLog && lastLog.event === status && (Date.now() - new Date(lastLog.timestamp).getTime()) < 3000) {
        return;
      }
      prev.push({ 
        timestamp: new Date().toISOString(), 
        event: status 
      });
    }
  }, [status]);

  useEffect(() => {
    if (status === "LOADING") return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          finishInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  // Initialize Interview Session with Backend
  useEffect(() => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;

    const initSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidate_name: candidateName,
            session_id: urlSessionId // Use the ID from the invitation link
          })
        });
        const data = await res.json();
        sessionIdRef.current = data.session_id;
      } catch (err) {
        console.error("Failed to start session on backend", err);
      }
    };
    initSession();
  }, [candidateName]);

  const finishInterview = () => {
    const finalSessionId = sessionIdRef.current;
    const finalLogs = currentLogsRef.current;

    const finalizeAndNavigate = () => {
      let videoUrl = null;
      if (recordedChunksRef.current.length > 0) {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        videoUrl = URL.createObjectURL(blob);
      }
      navigate("/review", { state: { videoUrl, logs: finalLogs, sessionId: finalSessionId } });
    };

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        finalizeAndNavigate();
      };
      mediaRecorderRef.current.stop();
    } else {
      finalizeAndNavigate();
    }
  };

  const getStatusDisplay = () => {
    switch (status) {
      case "LOADING": return { text: "Initializing AI Models...", className: "warning" };
      case "GOOD": return { text: "✓ Face Verified - Secure", className: "good" };
      case "NO_FACE": return { text: "⚠ No Face Detected", className: "warning" };
      case "MULTIPLE_FACES": return { text: "⚠ Multiple People Detected", className: "warning" };
      case "PHONE_DETECTED": return { text: "⛔ CELL PHONE DETECTED", className: "warning" };
      case "LOOKING_AWAY": return { text: "⚠ Please look at the screen", className: "warning" };
      case "MULTIPLE_DISPLAYS": return { text: "⛔ MULTIPLE DISPLAYS DETECTED", className: "warning" };
      case "SECURITY_ALERT": return { text: "⛔ SECURITY ALERT: FOCUS LOST", className: "warning" };
      case "TAB_SWITCH": return { text: "⛔ SECURITY ALERT: TAB SWITCH", className: "warning" };
      case "DUPLICATE_DISPLAY": return { text: "⛔ BLOCKER: DUPLICATE/EXTERNAL SCREEN", className: "warning" };
      case "PERIPHERAL_DETECTED": return { text: "⚠ EXTERNAL PERIPHERAL DETECTED", className: "warning" };
      case "STRESS_ALERT": return { text: "🔥 AI ALERT: SUSTAINED HIGH STRESS DETECTED", className: "warning" };
      case "BEHAVIORAL_ANOMALY": return { text: "⚠ BEHAVIORAL ANOMALY: UNUSUAL PATTERNS", className: "warning" };
    }
  };

  const statusInfo = getStatusDisplay();
  const wrapperClass = status === "LOADING" ? "" : (status === "GOOD" ? "status-good" : "status-warning");

  return (
    <div className="proctoring-container">
      <div className="header">
        <div className="session-badge">SECURE SESSION • {candidateName.toUpperCase()}</div>
        <h1 className="premium-gradient-text">HyrAI Proctoring</h1>
        {status !== "LOADING" && (
          <div className={`timer-badge ${timeLeft < 30 ? 'alert' : ''}`}>
            REGULATION TIMER: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        )}
      </div>

      <div className={`video-wrapper ${wrapperClass}`}>
        {status === "LOADING" && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <div className="loading-text">BOOTING AI CORE • NEURAL AUDIT ACTIVE</div>
          </div>
        )}

        {status !== "LOADING" && (
          <div className={`status-badge ${statusInfo.className}`}>
            {statusInfo.text}
          </div>
        )}

        {status !== "GOOD" && status !== "LOADING" && (
          <div className="violation-toast">
            <span className="blink">●</span> AI ALERT: {statusInfo.text.split(' ').slice(1).join(' ')}
          </div>
        )}

        {USE_EXTENSION_SECURITY && extensionInstalled === false && (
          <div className="display-error-badge glass-panel" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: '2.5rem', zIndex: 100, textAlign: 'center', width: '450px', border: '1px solid var(--primary)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
            <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>HYRAI SECURITY GUARD MISSING</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '2rem' }}>
              To ensure interview integrity, the HyrAI Secure Extension is mandatory. Please install it to proceed with your session.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-premium"
                style={{ textDecoration: 'none', display: 'inline-block' }}
              >
                Install from Web Store
              </a>
              <button
                className="btn-glass"
                onClick={() => window.location.reload()}
                style={{ padding: '0.8rem 1.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer' }}
              >
                I've installed it
              </button>
            </div>
          </div>
        )}

        {displayError && !displayPermission && (!USE_EXTENSION_SECURITY || extensionInstalled !== false) && (
          <div className="display-error-badge glass-panel" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: '2rem', zIndex: 50, textAlign: 'center', maxWidth: '80%' }}>
            <p style={{ color: 'var(--error)', fontWeight: 600 }}>DISPLAY SECURITY PROTOCOL REQUIRED</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>{displayError}</p>
            <button className="btn-premium" onClick={() => {
              // @ts-ignore
              if (window.triggerDisplaySecurity) window.triggerDisplaySecurity();
            }}>
              Authorize Hardware Audit
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          className="video-element"
          autoPlay
          playsInline
          muted
        />
      </div>

      <div className="metrics-panel">
        <div className="metric-card">
          <div className="label">Subjects Detected</div>
          <div className="value">{status === "LOADING" ? "-" : faceCount}</div>
        </div>
        <div className="metric-card">
          <div className="label">Display Count</div>
          <div className={`value ${screenCount > 1 ? 'alert' : ''}`}>{status === "LOADING" ? "-" : screenCount}</div>
          <div className="sub-label" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
            {isExternalDisplay ? "External Input Detected" : "Built-in Display"}
          </div>
        </div>
        <div className="metric-card">
          <div className="label">Pointer Audit</div>
          <div className="value" style={{ textTransform: 'capitalize' }}>{status === "LOADING" ? "-" : (pointerType || "System")}</div>
          <div className="sub-label" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>Active Peripheral</div>
        </div>
        <div className="metric-card">
          <div className="label">Emotion Profile</div>
          <div className="value">{status === "LOADING" ? "-" : emotion}</div>
          <div className="sub-label" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
            Stress Index: {stressLevel}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default Proctoring;