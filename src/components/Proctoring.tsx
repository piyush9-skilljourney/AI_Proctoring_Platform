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
  | "PERIPHERAL_DETECTED";

const CHROME_EXTENSION_ID = import.meta.env.VITE_CHROME_EXTENSION_ID || "jlgeegkokgbcapibagboldphomponhac";
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
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [displayPermission, setDisplayPermission] = useState<boolean>(false);

  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const currentLogsRef = useRef<{ timestamp: number; type: ProctoringStatus }[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const interviewStartTimeRef = useRef<number>(Date.now());
  const sessionStartedRef = useRef(false);

  // Use refs to avoid stale closures in the requestAnimationFrame loop
  const invalidStartTimeRef = useRef<number | null>(null);
  const currentDisplayStatusRef = useRef<ProctoringStatus>("LOADING");
  const securityViolationRef = useRef<ProctoringStatus | null>(null);

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

            if (nose && leftCheek && rightCheek) {
              const leftDist = Math.abs(nose.x - leftCheek.x);
              const rightDist = Math.abs(nose.x - rightCheek.x);

              // Calculate ratio between left distance and right distance
              // High ratio means looking far left, low means looking far right
              const ratio = leftDist / (rightDist + 0.0001);

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
            } else if (screens.length === 1 && !screens[0].isInternal) {
              // If only one screen and it's NOT internal, suspect duplicate/mirror mode
              securityViolationRef.current = "DUPLICATE_DISPLAY";
            } else if (securityViolationRef.current === "MULTIPLE_DISPLAYS" || securityViolationRef.current === "DUPLICATE_DISPLAY") {
              securityViolationRef.current = null;
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
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
        securityViolationRef.current = "PERIPHERAL_DETECTED";
      } else if (securityViolationRef.current === "PERIPHERAL_DETECTED") {
        securityViolationRef.current = null;
      }
    };

    // Try to setup immediately, but it might fail without user interaction
    setupDisplaySecurity();

    // Export a function to allow manual triggering if needed
    // @ts-ignore
    window.triggerDisplaySecurity = () => setupDisplaySecurity(true);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pointerdown", handlePointerType);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("copy", handleCopyPaste);
    window.addEventListener("paste", handleCopyPaste);

    // 5. Continuous Extension Security Polling (Hardware Audit)
    const extensionPollInterval = setInterval(() => {
      if (!isComponentMounted) return;

      const suspiciousNames = [
        "generic", "pnp", "hdmi", "displayport", "dp", 
        "samsung", "lg", "dell", "benq", "acer", "asus", 
        "viewsonic", "projector", "television", "tv"
      ];

      if (window.chrome?.runtime?.sendMessage) {
        try {
          window.chrome.runtime.sendMessage(CHROME_EXTENSION_ID, { type: "GET_DISPLAY_SECURITY" }, (res: any) => {
            if (window.chrome.runtime.lastError) {
              console.warn("[HyrAI] Extension disconnected during session.");
              return;
            }

            if (res && res.success) {
              const { displayCount, isMirrored, hasExternal, displays } = res;
              const logicalCount = screenCount;

              // HEURISTIC 1: Hardware-to-Software Discrepancy
              const isDiscrepancy = displayCount > window.screen.availWidth / window.screen.width ? false : (displayCount > logicalCount); 
              // (More robust discrepancy check)
              
              // HEURISTIC 2: Display Name (EDID) Analysis - THE BREAKTHROUGH
              const hasSuspiciousName = displays?.some((d: any) => 
                suspiciousNames.some(name => d.name?.toLowerCase().includes(name))
              );

              if (isMirrored || (displayCount > 1 && logicalCount === 1) || hasSuspiciousName) {
                securityViolationRef.current = "DUPLICATE_DISPLAY";
                setScreenCount(displayCount);
              } else if (displayCount > 1) {
                securityViolationRef.current = "MULTIPLE_DISPLAYS";
                setScreenCount(displayCount);
              } else {
                if (securityViolationRef.current === "MULTIPLE_DISPLAYS" || securityViolationRef.current === "DUPLICATE_DISPLAY") {
                  if (displayCount === 1 && logicalCount === 1) securityViolationRef.current = null;
                }
                setScreenCount(displayCount);
                setIsExternalDisplay(hasExternal);

                // LAYER 4: Audio Peripheral Audit (Sync with Display Audit)
                navigator.mediaDevices.enumerateDevices().then(devices => {
                  const hasExternalAudio = devices.some(d => 
                    d.kind === 'audiooutput' && 
                    (d.label.toLowerCase().includes('hdmi') || 
                     d.label.toLowerCase().includes('displayport') ||
                     suspiciousNames.slice(5).some(brand => d.label.toLowerCase().includes(brand)))
                  );
                  if (hasExternalAudio && (securityViolationRef.current === null || securityViolationRef.current === "GOOD")) {
                    if (hasExternal) securityViolationRef.current = "DUPLICATE_DISPLAY";
                  }
                });
              }
            }
          });
        } catch (e) {
          console.error("Extension polling failed:", e);
        }
      }
    }, 3000);

    return () => {
      isComponentMounted = false;
      clearInterval(extensionPollInterval);
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
    };
  }, []);

  useEffect(() => {
    if (status !== "GOOD" && status !== "LOADING") {
      const prev = currentLogsRef.current;
      const lastLog = prev[prev.length - 1];
      const currentTimeOffset = Date.now() - interviewStartTimeRef.current;

      if (lastLog && lastLog.type === status && (currentTimeOffset - lastLog.timestamp) < 3000) {
        return;
      }
      prev.push({ timestamp: currentTimeOffset, type: status });
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

        {displayError && !displayPermission && (
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
          <div className="label">Neural Health</div>
          <div className="value" style={{ color: status === "GOOD" ? 'var(--success)' : 'var(--error)' }}>
            {status === "LOADING" ? "BOOTING" : status === "GOOD" ? "SECURE" : "ALERT"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Proctoring;