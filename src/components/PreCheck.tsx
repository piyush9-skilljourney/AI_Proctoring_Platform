import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PreCheck.css";

const PreCheck = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const [permissions, setPermissions] = useState({ camera: false, mic: false });
  const [micVolume, setMicVolume] = useState(0);
  const [networkSpeed, setNetworkSpeed] = useState<{ speedMbps: number; status: "testing" | "pass" | "fail" }>({
    speedMbps: 0,
    status: "testing"
  });
  
  const [noiseStatus, setNoiseStatus] = useState<"testing" | "pass" | "fail">("testing");
  const volumeHistoryRef = useRef<number[]>([]);

  const [displayStatus, setDisplayStatus] = useState<"pending" | "pass" | "fail">("pending");
  const [displayMsg, setDisplayMsg] = useState("Click 'Authorize System' to test");

  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [candidateName, setCandidateName] = useState("");

  // 1. Network Test (Averaged over 3 fetches)
  useEffect(() => {
    let active = true;
    const testNetwork = async () => {
      let totalSpeed = 0;
      const iterations = 3;
      
      for (let i = 0; i < iterations; i++) {
        if (!active) return;
        try {
          const startTime = performance.now();
          const response = await fetch("https://httpbin.org/bytes/100000"); // 100kb payload
          await response.blob();
          const endTime = performance.now();
          
          const durationSeconds = (endTime - startTime) / 1000;
          const bitsLoaded = 100000 * 8;
          const speedMbps = (bitsLoaded / durationSeconds) / (1024 * 1024);
          totalSpeed += speedMbps;
        } catch (e) {
          if (active) setNetworkSpeed({ speedMbps: 0, status: "fail" });
          return;
        }
      }
      
      if (active) {
        const avgSpeed = totalSpeed / iterations;
        setNetworkSpeed({
          speedMbps: parseFloat(avgSpeed.toFixed(2)),
          status: avgSpeed >= 0.5 ? "pass" : "fail" // Lowered threshold to 0.5 Mbps
        });
      }
    };
    testNetwork();
    return () => { active = false; };
  }, []);

  // 2. Camera, Mic & Background Noise
  useEffect(() => {
    let stream: MediaStream | null = null;

    const setupMedia = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true
        });

        setPermissions({ camera: true, mic: true });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        audioContextRef.current = new window.AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const updateVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const percentage = Math.min(100, Math.round((average / 255) * 100 * 2));
          setMicVolume(percentage);

          // Background Noise continuous assessment
          volumeHistoryRef.current.push(percentage);
          if (volumeHistoryRef.current.length > 120) { // ~2 seconds rolling window at 60fps
             volumeHistoryRef.current.shift();
             const avgNoise = volumeHistoryRef.current.reduce((a, b) => a + b, 0) / 120;
             if (avgNoise > 35) { // If continuous average is > 35%, background is too noisy
               setNoiseStatus("fail");
             } else {
               setNoiseStatus("pass");
             }
          }

          animationRef.current = requestAnimationFrame(updateVolume);
        };
        updateVolume();

      } catch (err: any) {
        setPermissions({ camera: false, mic: false });
        setErrorMsg("Failed to access Camera or Microphone.");
      }
    };

    setupMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // 3. Display & Peripheral Authorization
  const handleAuthorizeSetup = async (e: React.PointerEvent) => {
    const inputType = e.pointerType; // 'mouse', 'touch', 'pen'
    
    try {
      if (!window.isSecureContext) {
        setDisplayStatus("fail");
        setDisplayMsg("Environment not secure.");
        return;
      }

      // @ts-ignore
      if ("getScreenDetails" in window || "getScreens" in window) {
        // @ts-ignore
        const screenDetails = await window.getScreenDetails();
        const screens = screenDetails.screens;
        
        if (screens.length > 1) {
          setDisplayStatus("fail");
          setDisplayMsg("Multiple displays detected. Please disconnect external monitors.");
        } else if (!screens[0].isInternal) {
          setDisplayStatus("fail");
          setDisplayMsg("External display used as primary frame. Not allowed.");
        } else {
          setDisplayStatus("pass");
          setDisplayMsg(`Display verified. Input method: ${inputType}`);
        }
      } else {
        // @ts-ignore
        if (window.screen.isExtended) {
          setDisplayStatus("fail");
          setDisplayMsg("Extended display detected.");
        } else {
          setDisplayStatus("pass");
          setDisplayMsg(`Platform verified. Input method: ${inputType}`);
        }
      }
    } catch (err) {
      setDisplayStatus("fail");
      setDisplayMsg("Window permissions denied.");
    }
  };

  useEffect(() => {
    if (
        permissions.camera && 
        permissions.mic && 
        networkSpeed.status === "pass" && 
        noiseStatus !== "fail" &&
        displayStatus === "pass"
    ) {
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [permissions, networkSpeed, noiseStatus, displayStatus]);

  return (
    <div className="precheck-container">
      <div className="precheck-card">
        <h1>System Validation</h1>
        <p className="subtitle">Let's verify your environment setup before the interview begins.</p>

        {errorMsg && <div className="error-banner">{errorMsg}</div>}

        <div style={{marginBottom: "20px", textAlign: "left"}}>
          <label style={{display: "block", color: "#94a3b8", fontSize: "0.9rem", marginBottom: "5px"}}>Candidate Full Name</label>
          <input 
            type="text" 
            value={candidateName} 
            onChange={(e) => setCandidateName(e.target.value)}
            placeholder="Enter your name"
            style={{
               width: "100%", padding: "12px", borderRadius: "8px", 
               border: "1px solid #334155", background: "#0f172a", 
               color: "white", fontSize: "1rem"
            }}
          />
        </div>

        <div className="check-grid">
          <div className="video-preview-wrapper">
            <video ref={videoRef} autoPlay playsInline muted className="preview-video" />
            <div className={`status-badge ${permissions.camera ? 'pass' : 'fail'}`}>
              {permissions.camera ? '✓ Camera Active' : '✗ Camera Blocked'}
            </div>
            
            <div className="display-auth-overlay">
                <button 
                  className={`auth-btn ${displayStatus !== 'pending' ? displayStatus : ''}`}
                  onPointerDown={handleAuthorizeSetup}
                >
                   {displayStatus === 'pending' ? 'Authorize System (Click)' : displayMsg}
                </button>
            </div>
          </div>

          <div className="metrics-column">
            {/* Audio Check */}
            <div className="metric-box">
              <div className="metric-header">
                <h3>Microphone</h3>
                <span className={`status ${permissions.mic ? 'pass' : 'fail'}`}>
                   {permissions.mic ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="volume-bar-track">
                <div 
                  className="volume-bar-fill" 
                  style={{ 
                    width: `${micVolume}%`,
                    backgroundColor: micVolume > 80 ? '#f59e0b' : '#10b981'
                  }}
                />
              </div>
              <div className="sub-metric">
                 <span className="info-text">Background noise level:</span>
                 <span className={`status-small ${noiseStatus}`}>
                    {noiseStatus === 'testing' ? 'Analyzing...' : noiseStatus === 'pass' ? 'Low' : 'Too High'}
                 </span>
              </div>
            </div>

            {/* Network Check */}
            <div className="metric-box">
              <div className="metric-header">
                <h3>Network Speed (Avg)</h3>
                <span className={`status ${networkSpeed.status}`}>
                  {networkSpeed.status === 'testing' ? 'Testing...' : 
                   networkSpeed.status === 'pass' ? 'Good' : 'Poor'}
                </span>
              </div>
              <div className="speed-result">
                <span className="speed-val">{networkSpeed.speedMbps}</span> Mbps
              </div>
              <span className="info-text">Minimum requirement: 0.5 Mbps</span>
            </div>
          </div>
        </div>

        <div className="action-row">
          <button 
            className={`btn-primary ${!isReady || candidateName.trim() === '' ? 'disabled' : ''}`}
            disabled={!isReady || candidateName.trim() === ''}
            onClick={async () => {
               try {
                  if (document.documentElement.requestFullscreen) {
                     await document.documentElement.requestFullscreen();
                  }
               } catch (err) {
                  console.warn("Fullscreen request failed", err);
               }
               navigate('/interview', { state: { candidateName } });
            }}
          >
            Start Interview
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreCheck;
