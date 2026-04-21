import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./PreCheck.css";

declare global {
  interface Window {
    chrome: any;
  }
}

const CHROME_EXTENSION_ID = "jlgeegkokgbcapibagboldphomponhac";

interface DisplayInfo {
  displayCount: number;
  isMirrored: boolean;
  success: boolean;
  displays: {
    id: string;
    isInternal: boolean;
    isPrimary: boolean;
    name?: string;
  }[];
}

const PreCheck = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [extensionStatus, setExtensionStatus] = useState<"not_found" | "checking" | "found" | "not_supported">("checking");
  const [showGuide, setShowGuide] = useState(false);

  const [isReady, setIsReady] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [interviewData, setInterviewData] = useState<any>(null);

  // 0. Handle Invitation Parameter (Optional for Manual Testing)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const inviteId = params.get("invite");
    if (inviteId) {
      fetch(`http://127.0.0.1:8000/api/interviews/invite/${inviteId}`)
        .then(res => res.json())
        .then(data => {
          if (data.candidate_name) {
            setCandidateName(data.candidate_name);
            setInterviewData(data);
          }
        })
        .catch(() => console.log("Direct access mode enabled (No Invite)"));
    }
  }, [location.search]);

  // 1. Extension Detection
  useEffect(() => {
    console.log("[HyrAI Debug] chrome object:", !!window.chrome);
    console.log("[HyrAI Debug] chrome.runtime:", !!window.chrome?.runtime);
    console.log("[HyrAI Debug] sendMessage fn:", typeof window.chrome?.runtime?.sendMessage);

    if (!window.chrome || !window.chrome.runtime || !window.chrome.runtime.sendMessage) {
      console.warn("[HyrAI] Chrome runtime not available. Extension detection disabled.");
      setExtensionStatus("not_supported");
      return;
    }

    const check = () => {
      try {
        console.log("[HyrAI Debug] Pinging extension:", CHROME_EXTENSION_ID);
        window.chrome.runtime.sendMessage(CHROME_EXTENSION_ID, { type: "PING" }, (res: any) => {
          const err = window.chrome.runtime.lastError;
          if (err) {
            console.warn("[HyrAI] Extension PING failed:", err.message);
            setExtensionStatus("not_found");
          } else {
            console.log("[HyrAI] Extension PING success:", res);
            setExtensionStatus("found");
          }
        });
      } catch (e) {
        console.error("[HyrAI] Extension check exception:", e);
        setExtensionStatus("not_found");
      }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  // 2. Camera, Mic, Network
  useEffect(() => {
    let stream: MediaStream | null = null;
    const setupMedia = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setPermissions({ camera: true, mic: true });
        if (videoRef.current) videoRef.current.srcObject = stream;

        audioContextRef.current = new window.AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const update = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = dataArray.reduce((p, c) => p + c, 0);
          const pct = Math.min(100, Math.round((sum / dataArray.length / 255) * 200));
          setMicVolume(pct);
          volumeHistoryRef.current.push(pct);
          if (volumeHistoryRef.current.length > 50) {
            volumeHistoryRef.current.shift();
            const avg = volumeHistoryRef.current.reduce((a, b) => a + b, 0) / 50;
            setNoiseStatus(avg > 35 ? "fail" : "pass");
          }
          animationRef.current = requestAnimationFrame(update);
        };
        update();
      } catch { setPermissions({ camera: false, mic: false }); }
    };
    setupMedia();

    const testNet = async () => {
      try {
        const start = performance.now();
        await fetch("https://httpbin.org/bytes/50000");
        const dur = (performance.now() - start) / 1000;
        const spd = (50000 * 8 / dur) / (1024 * 1024);
        setNetworkSpeed({ speedMbps: parseFloat(spd.toFixed(2)), status: spd > 0.4 ? "pass" : "fail" });
      } catch { setNetworkSpeed({ speedMbps: 0, status: "fail" }); }
    };
    testNet();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // 3. Hardware Audit Logic
  // PRIORITY: Extension > Browser API > Heuristics
  // Extension is checked FIRST because it's the ONLY way to detect Duplicate/Mirror mode.
  const handleAuthorizeSetup = async () => {
    try {
      // ═══════════════════════════════════════════════════════════
      // STEP 1: EXTENSION CHECK (highest priority — sees physical hardware)
      // ═══════════════════════════════════════════════════════════
      if (extensionStatus === "found") {
        window.chrome.runtime.sendMessage(CHROME_EXTENSION_ID, { type: "GET_DISPLAY_SECURITY" }, (res: any) => {
          console.log("[HyrAI] Extension raw response:", JSON.stringify(res));

          if (!res || !res.success) {
            setDisplayStatus("fail");
            setDisplayMsg("Extension could not read display hardware.");
            return;
          }

          // Direct API flags
          if (res.isMirrored) {
            setDisplayStatus("fail");
            setDisplayMsg("⛔ DUPLICATED DISPLAY DETECTED (Mirroring via HDMI/DP).");
            return;
          }
          if (res.displayCount > 1) {
            setDisplayStatus("fail");
            setDisplayMsg(`⛔ ${res.displayCount} PHYSICAL MONITORS DETECTED. Disconnect external display.`);
            return;
          }
          if (res.hasExternal) {
            setDisplayStatus("fail");
            setDisplayMsg("⛔ EXTERNAL MONITOR DETECTED. Use laptop screen only.");
            return;
          }

          // ─── HEURISTIC CROSS-VALIDATION ───
          // Windows "Duplicate" mode hides the second monitor from the API.
          // But it leaves clues we can detect:
          const display = res.displays?.[0];
          if (display) {
            const name = (display.name || "").toLowerCase();
            // "Generic PnP Monitor" = HDMI/DP plugged in (real laptop panels show manufacturer names like BOE, AUO, Sharp)
            const suspiciousNames = ["generic", "pnp", "hdmi", "displayport", "dp", "samsung", "lg", "dell", "benq", "acer", "asus", "viewsonic", "projector"];
            const isSuspiciousName = suspiciousNames.some(s => name.includes(s));

            if (isSuspiciousName) {
              setDisplayStatus("fail");
              setDisplayMsg(`⛔ Suspicious display: "${display.name}". Unplug HDMI/DP cable.`);
              return;
            }
          }

          // All checks passed
          setDisplayStatus("pass");
          setDisplayMsg("✓ Verified — Single internal display confirmed.");
        });
        return; // Extension handles everything, don't run browser checks
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 2: BROWSER API FALLBACK (only if no extension)
      // ═══════════════════════════════════════════════════════════

      // 2A: screen.isExtended (catches "Extend" mode but NOT "Duplicate")
      // @ts-ignore
      if (window.screen.isExtended) {
        setDisplayStatus("fail");
        setDisplayMsg("Extended desktop detected. Use single screen only.");
        return;
      }

      // 2B: getScreenDetails API
      // @ts-ignore
      if ("getScreenDetails" in window) {
        try {
          // @ts-ignore
          const details = await window.getScreenDetails();
          if (details.screens.length > 1) {
            setDisplayStatus("fail");
            setDisplayMsg(`${details.screens.length} monitors detected via browser API.`);
            return;
          }
          if (!details.screens[0].isInternal) {
            setDisplayStatus("fail");
            setDisplayMsg("External screen detected. Use built-in display only.");
            return;
          }
        } catch (e) {
          console.warn("getScreenDetails failed:", e);
        }
      }

      // 2C: Audio peripheral heuristic
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hdmiAudio = devices.find(d =>
        d.kind === 'audiooutput' &&
        ["hdmi", "displayport", "samsung", "lg", "dell", "tv", "monitor"].some(k => d.label.toLowerCase().includes(k))
      );
      if (hdmiAudio) {
        setDisplayStatus("fail");
        setDisplayMsg(`External display audio detected: ${hdmiAudio.label}`);
        return;
      }

      // If we got here without extension, warn the user
      setDisplayStatus("fail");
      setDisplayMsg("⚠ Cannot detect mirror mode without extension. Click 'Installation Help'.");

    } catch (err) {
      setDisplayStatus("fail");
      setDisplayMsg("Audit verification failed.");
    }
  };

  useEffect(() => {
    const ready = permissions.camera && permissions.mic && networkSpeed.status === "pass" && noiseStatus !== "fail" && displayStatus === "pass" && candidateName.length > 2;
    setIsReady(ready);
  }, [permissions, networkSpeed, noiseStatus, displayStatus, candidateName]);

  return (
    <div className="precheck-container">
      {showGuide && (
        <div className="guide-modal">
          <div className="guide-content">
            <h2>HyrAI Security Guide</h2>
            <p>To prevent screen mirroring (HDMI/DisplayPort) and ensure fairness, please install our extension.</p>
            <ol>
              <li>Download <strong>HyrAI_Guard.zip</strong>.</li>
              <li>Open <code>chrome://extensions</code>.</li>
              <li>Enable <strong>Developer mode</strong>.</li>
              <li><strong>Load unpacked</strong> and select the extension folder.</li>
            </ol>
            <button className="action-btn" onClick={() => setShowGuide(false)}>Close Guide</button>
          </div>
        </div>
      )}

      <div className="precheck-card">
        <h1>Proctoring Validation</h1>
        <p className="subtitle">Production hardware security scan.</p>

        {interviewData ? (
          <div className="jd-banner">
            <h3>Role: {interviewData.job_type}</h3>
            <p>{interviewData.jd}</p>
          </div>
        ) : (
          <div className="jd-banner" style={{ border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent' }}>
            <h3 style={{ color: '#94a3b8' }}>MANUAL TESTING MODE</h3>
            <p>Invitation logic bypassed. System open for proctoring verification.</p>
          </div>
        )}

        <div className="candidate-input">
          <label>Candidate Name</label>
          <input
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            disabled={!!interviewData}
            placeholder="Identity verification required"
          />
        </div>

        <div className="check-grid">
          <div className="video-preview-wrapper">
            <video ref={videoRef} autoPlay playsInline muted className="preview-video" />
            <div className={`status-badge ${permissions.camera ? 'pass' : 'fail'}`}>
              {permissions.camera ? '✓ Identity Verified' : '✗ Camera Blocked'}
            </div>
            <div className="display-auth-overlay">
              <button className={`auth-btn ${displayStatus}`} onClick={handleAuthorizeSetup}>
                {displayMsg}
              </button>
            </div>
          </div>

          <div className="metrics-column">
            <div className="metric-box">
              <div className="metric-header">
                <h3>Audio Stream</h3>
                <span className={`status ${permissions.mic ? 'pass' : 'fail'}`}>{permissions.mic ? 'Live' : 'Off'}</span>
              </div>
              <div className="volume-bar-track">
                <div className="volume-bar-fill" style={{ width: `${micVolume}%`, background: micVolume > 70 ? '#f87171' : '#34d399' }} />
              </div>
              <p className="info-text">Ambient Level: {noiseStatus === 'fail' ? "Noisy" : "Clear"}</p>
            </div>

            <div className="metric-box">
              <div className="metric-header">
                <h3>Security Extension</h3>
                <span className={`status ${extensionStatus === 'found' ? 'pass' : 'fail'}`}>
                  {extensionStatus === 'found' ? 'Active' : 'Missing'}
                </span>
              </div>
              <button className="guide-link-btn" onClick={() => setShowGuide(true)}>Installation Help</button>
            </div>

            <div className="metric-box">
              <div className="metric-header">
                <h3>Network Link</h3>
                <span className={`status ${networkSpeed.status}`}>{networkSpeed.status === 'pass' ? 'Stable' : 'Unstable'}</span>
              </div>
              <p className="sub-metric-info">{networkSpeed.speedMbps} Mbps</p>
            </div>
          </div>
        </div>

        <div className="action-row">
          <button
            className={`btn-primary ${!isReady ? 'disabled' : ''}`}
            disabled={!isReady}
            onClick={() => {
              document.documentElement.requestFullscreen().catch(() => { });
              navigate('/interview', { state: { candidateName, jobType: interviewData?.job_type } });
            }}
          >
            Enter Secure Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreCheck;
