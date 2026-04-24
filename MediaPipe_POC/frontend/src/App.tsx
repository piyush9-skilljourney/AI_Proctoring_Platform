import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FaceEngine, type DetectionResults } from './engines/FaceEngine';
import { ObjectEngine, type ObjectDetectionResults } from './engines/ObjectEngine';
import { EmotionEngine, type EmotionResults } from './engines/EmotionEngine';
import { HardwareEngine, type HardwareStatus } from './engines/HardwareEngine';
import { HardwareIntegrityEngine, type IntegrityResults } from './engines/HardwareIntegrityEngine';
import { NeuralEngine } from './engines/NeuralEngine';
import { FeatureEngine } from './engines/FeatureEngine';
import { ScoringEngine } from './engines/ScoringEngine';
import { SuspicionEngine } from './engines/SuspicionEngine';

const BACKEND_URL = 'http://localhost:8000';

interface AuditLog {
  id: string;
  type: string;
  message: string;
  time: string;
  severity: 'low' | 'high';
}

interface Incident {
  id: string;
  label: string;
  severity: 'critical' | 'warning' | 'info';
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceEngineRef = useRef<FaceEngine | null>(null);
  const objectEngineRef = useRef<ObjectEngine | null>(null);
  const emotionEngineRef = useRef<EmotionEngine | null>(null);
  const hardwareEngineRef = useRef<HardwareEngine | null>(null);
  const integrityEngineRef = useRef<HardwareIntegrityEngine | null>(null);
  const neuralEngineRef = useRef<NeuralEngine | null>(null);
  const scoringEngineRef = useRef<ScoringEngine | null>(null);
  const suspicionEngineRef = useRef<SuspicionEngine | null>(null);
  const frameCountRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false); // NEW: Backpressure Control

  const [faceResults, setFaceResults] = useState<DetectionResults | null>(null);
  const [objectResults, setObjectResults] = useState<ObjectDetectionResults | null>(null);
  const [emotionResults, setEmotionResults] = useState<EmotionResults | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<HardwareStatus | null>(null);
  const [integrityResults, setIntegrityResults] = useState<IntegrityResults | null>(null);
  const [behavioralMetrics, setBehavioralMetrics] = useState({ stress: 0, engagement: 0, state: 'Initializing...' });
  const [suspicionRisk, setSuspicionRisk] = useState<{ level: string; reasons: string[] }>({ level: 'low', reasons: [] });
  const [isSimulatingStress, setIsSimulatingStress] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isDebugJitter, setIsDebugJitter] = useState(false);
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const addLog = (type: string, message: string, severity: 'low' | 'high' = 'low') => {
    const newLog: AuditLog = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      message,
      time: new Date().toLocaleTimeString(),
      severity
    };
    setAuditLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  useEffect(() => {
    const init = async () => {
      addLog("SYSTEM", "Initializing Neural Engines...", "low");
      try {
        const res = await axios.post(`${BACKEND_URL}/api/poc/session/start`, {
          candidate_name: "Audit Candidate",
          assessment_id: "POC-NEURAL-01"
        });
        setSessionId(res.data.session_id);
      } catch (err) {
        addLog("SYSTEM", "Backend unavailable - Offline mode active", "high");
      }

      const faceEngine = new FaceEngine();
      const objectEngine = new ObjectEngine();
      const emotionEngine = new EmotionEngine();
      const hardwareEngine = new HardwareEngine();
      const integrityEngine = new HardwareIntegrityEngine();
      const neuralEngine = new NeuralEngine();
      const scoringEngine = new ScoringEngine();
      const suspicionEngine = new SuspicionEngine();

      try {
        faceEngineRef.current = faceEngine;
        objectEngineRef.current = objectEngine;
        emotionEngineRef.current = emotionEngine;
        hardwareEngineRef.current = hardwareEngine;
        integrityEngineRef.current = integrityEngine;
        neuralEngineRef.current = neuralEngine;
        scoringEngineRef.current = scoringEngine;
        suspicionEngineRef.current = suspicionEngine;

        await Promise.all([
          faceEngine.initialize(),
          objectEngine.initialize(),
          neuralEngine.initialize() // Booting the brain
        ]);

        hardwareEngine.subscribe(status => {
          setHardwareStatus(status);
        });

        setIsReady(true);
        addLog("SYSTEM", "Neural & Hardware Engines Synchronized", "low");
      } catch (err: any) {
        addLog("SYSTEM", `Engine failure: ${err.message || "Unknown error"}`, "high");
      }

      if (videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: false
          });
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        } catch (err) {
          addLog("SYSTEM", "Camera access denied", "high");
        }
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!faceEngineRef.current || !objectEngineRef.current || !videoRef.current || !emotionEngineRef.current) return;

    let requestRef: number;
    let lastLogTime = 0;

    const loop = () => {
      if (videoRef.current && faceEngineRef.current && objectEngineRef.current && emotionEngineRef.current && isReady) {
        if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
          requestRef = requestAnimationFrame(loop);
          return;
        }

        try {
          const timestamp = performance.now();
          const face = faceEngineRef.current.detect(videoRef.current, timestamp);

          // Phase 2: Object Detection
          const objects = objectEngineRef.current.detect(videoRef.current, timestamp);
          setObjectResults(objects);

          const emotions = emotionEngineRef.current.process(face.rawBlendshapes);

          setFaceResults(face);
          setEmotionResults({ ...emotions });

          // --- PHASE 3 & 7: NEURAL AUDIT & EDGE CASES ---
          frameCountRef.current++;

          // 1. Edge Case: No Face Detected (Phase 7)
          if (!face.rawLandmarks || face.rawLandmarks.length === 0) {
            setBehavioralMetrics(prev => ({ ...prev, state: "Searching for face..." }));
            setSuspicionRisk({ level: 'low', reasons: [] });
          }
          // 2. Throttle + Backpressure Control (Phase 3)
          else if (frameCountRef.current % 6 === 0 && !isProcessingRef.current) {
            isProcessingRef.current = true; // Set Busy Signal

            try {
              const featureVector = FeatureEngine.extract(face.rawLandmarks);

              if (neuralEngineRef.current && scoringEngineRef.current) {
                const neuralOutputs = neuralEngineRef.current.predict(featureVector);
                const audit = scoringEngineRef.current.process(neuralOutputs);

                const finalStress = isSimulatingStress ? 90 : audit.stressIndex;

                setBehavioralMetrics({
                  stress: finalStress,
                  engagement: audit.engagementIndex,
                  state: audit.primaryState
                });

                // 3. Weighted Suspicion Engine (Phase 5)
                if (suspicionEngineRef.current) {
                  const risk = suspicionEngineRef.current.evaluate({
                    stressScore: finalStress,
                    gazeAway: face.isAlert,
                    objectsDetected: objects.isProhibited,
                    isTalking: emotions.isTalking
                  });
                  setSuspicionRisk(risk);
                }
              }
            } catch (e) {
              console.warn("Neural Loop Skip:", e);
            } finally {
              isProcessingRef.current = false; // Reset Busy Signal
            }
          }

          // Instant Multi-Violation Tracking
          const newIncidents: Incident[] = [];

          if (objects.isProhibited) {
            newIncidents.push({ id: `obj-${timestamp}`, label: objects.message, severity: 'critical' });

            // EVIDENCE CAPTURE: Take a snapshot if this is a fresh violation
            if (Math.random() < 0.1) {
              captureEvidence(objects.message);
            }
          }
          if (face.isAlert) {
            newIncidents.push({ id: `face-${timestamp}`, label: face.message, severity: 'warning' });
          }
          if (emotions.isTalking) {
            newIncidents.push({ id: `talk-${timestamp}`, label: 'TALKING DETECTED', severity: 'warning' });
          }

          // Phase 5: Hardware Integrity (Jitter)
          if (integrityEngineRef.current) {
            const integrity = integrityEngineRef.current.processFrame(timestamp);
            setIntegrityResults({ ...integrity });
            if (integrity.isCompromised) {
              newIncidents.push({ id: `jit-${timestamp}`, label: 'HARDWARE INTEGRITY COMPROMISED', severity: 'warning' });
              // Throttled Log for Jitter
              if (Math.random() < 0.05) { // Only log occasionally to prevent spam
                addLog("HARDWARE", "Inconsistent display pulse detected (Potential VM)", "high");
              }
            }
          }

          // Phase 4: Hardware Checks
          if (hardwareStatus && !hardwareStatus.isTabVisible) {
            newIncidents.push({ id: 'tab', label: 'TAB SWITCH DETECTED', severity: 'critical' });
          }
          if (hardwareStatus && !hardwareStatus.isWindowFocused) {
            newIncidents.push({ id: 'focus', label: 'WINDOW FOCUS LOST', severity: 'warning' });
          }
          if (hardwareStatus && hardwareStatus.isExtended) {
            newIncidents.push({ id: 'mon', label: 'SECONDARY MONITOR DETECTED', severity: 'warning' });
          }

          setActiveIncidents(newIncidents);

          // Throttled Persistence Logging
          const isSignificant = newIncidents.some(i => i.severity !== 'info');
          if (isSignificant && timestamp - lastLogTime > 4000) {
            const topIncident = newIncidents.find(i => i.severity === 'critical') || newIncidents[0];
            const msg = newIncidents.length > 1 ? `MULTIPLE: ${newIncidents.map(i => i.label).join(' + ')}` : topIncident.label;

            addLog("VIOLATION", msg, topIncident.severity === 'critical' ? 'high' : 'low');
            if (sessionId) {
              axios.post(`${BACKEND_URL}/api/poc/log`, {
                session_id: sessionId,
                type: "NEURAL_AUDIT",
                details: msg
              }).catch(() => { });
            }
            lastLogTime = timestamp;
          }
        } catch (err: any) {
          if (!err.message.includes("ROI")) {
            addLog("CRASH", `Loop failure: ${err.message}`, "high");
            return;
          }
        }
      }
      requestRef = requestAnimationFrame(loop);
    };

    requestRef = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(requestRef);
      neuralEngineRef.current?.dispose(); // Cleaning up GPU memory
    };
  }, [sessionId, isReady]);

  const hasCritical = activeIncidents.some(i => i.severity === 'critical');
  const isLocked = activeIncidents.some(i => i.id === 'tab');

  const startScreenAudit = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as any,
      });

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings() as any;

      if (settings.displaySurface !== "monitor") {
        addLog("SECURITY", "BLOCK: Entire Screen sharing is mandatory.", "high");
        track.stop();
        return;
      }

      addLog("SECURITY", "Screen Audit Verified. Starting Display Sync...", "low");
      setIsCalibrating(true);
      integrityEngineRef.current?.startCalibration();

      setTimeout(() => {
        setIsCalibrating(false);
        addLog("SECURITY", "Hardware Integrity Baseline Set", "low");
      }, 5500);

    } catch (err) {
      addLog("SECURITY", "Screen Audit Denied", "high");
    }
  };

  const toggleSimulation = () => {
    const newState = !isDebugJitter;
    setIsDebugJitter(newState);
    integrityEngineRef.current?.setDebugMode(newState);
    addLog("DEBUG", newState ? "Jitter Simulation: ACTIVE" : "Jitter Simulation: INACTIVE", "low");
  };

  const captureEvidence = (label: string) => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
      addLog("EVIDENCE", `Capture: ${label}`, "high");
      console.log(`📸 Evidence Captured for ${label}`);
      // In a real app, you would POST dataUrl to the backend here
    }
  };

  return (
    <>
      {/* Security Lockout Overlay */}
      {isLocked && (
        <div className="lockout-overlay">
          <div className="lockout-content">
            <h1 style={{ color: 'var(--danger)', fontSize: '2.5rem' }}>SECURITY BREACH</h1>
            <p>You have navigated away from the exam environment.</p>
            <p style={{ opacity: 0.7 }}>Return to this tab immediately to restore access.</p>
            <div className="pulse-circle" />
          </div>
        </div>
      )}

      {/* Phase 5: Calibration Overlay */}
      {isCalibrating && (
        <div className="calibration-overlay">
          <div className="lockout-content">
            <h2 style={{ color: 'var(--accent-primary)' }}>Syncing with Display...</h2>
            <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Please keep this window focused while we establish a hardware baseline.</p>
            <div className="calibration-progress-container">
              <div
                className="calibration-progress-bar"
                style={{ width: `${integrityEngineRef.current?.getCalibrationProgress()}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <aside className="audit-sidebar">
        <div className="audit-header">
          <div className={`dot ${sessionId ? 'dot-active' : 'dot-alert'}`} />
          Neural Audit Stream
        </div>

        {auditLogs.map(log => (
          <div key={log.id} className="audit-event" style={{ borderColor: log.severity === 'high' ? 'var(--danger)' : 'var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', opacity: 0.6, fontSize: '0.7rem' }}>
              <span>{log.type}</span>
              <span>{log.time}</span>
            </div>
            <div style={{ color: log.severity === 'high' ? 'var(--danger)' : 'var(--text-main)' }}>
              {log.message}
            </div>
          </div>
        ))}
      </aside>

      <main className="main-viewport">
        <div className={`video-feed-container ${hasCritical || suspicionRisk.level === 'high' ? 'hull-breach' : ''}`}>
          <video ref={videoRef} playsInline muted />

          {/* Neural Risk Badge */}
          <div className="risk-badge" style={{
            background: suspicionRisk.level === 'high' ? 'var(--danger)' : (suspicionRisk.level === 'medium' ? 'var(--warning)' : 'var(--success)'),
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            position: 'absolute',
            top: '20px',
            right: '20px',
            fontWeight: 'bold',
            fontSize: '0.8rem',
            zIndex: 10,
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <span>RISK: {suspicionRisk.level.toUpperCase()}</span>
            {suspicionRisk.reasons.length > 0 && (
              <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>{suspicionRisk.reasons.join(' | ')}</span>
            )}
          </div>

          {/* Instant Incident Rail */}
          <div className="overlay-status">
            {activeIncidents.length === 0 && (
              <div className="incident-chip chip-info" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
                <div className="dot dot-active" style={{ width: 8, height: 8 }} />
                SYSTEM SECURE
              </div>
            )}
            {activeIncidents.map(incident => (
              <div key={incident.id} className={`incident-chip chip-${incident.severity}`}>
                {incident.severity === 'critical' ? '🛑' : (incident.severity === 'warning' ? '⚠️' : 'ℹ️')}
                {incident.label}
              </div>
            ))}
          </div>
        </div>

        <div className="telemetry-grid">
          <div className="telemetry-card">
            <div className="telemetry-label">Eyeball Precision (L)</div>
            <div className="telemetry-value">{(faceResults?.iris.left.x || 0.5).toFixed(2)}</div>
          </div>
          <div className="telemetry-card">
            <div className="telemetry-label">Behavioral State</div>
            <div className="telemetry-value" style={{
              fontSize: '0.9rem',
              color: emotionResults?.isTalking ? 'var(--danger)' : 'var(--accent-primary)'
            }}>
              {emotionResults?.state || "Calibrating..."}
            </div>
          </div>
          <div className="telemetry-card">
            <div className="telemetry-label">Neural Stress Score</div>
            <div className="telemetry-value" style={{ color: behavioralMetrics.stress > 60 ? 'var(--danger)' : 'var(--accent-primary)' }}>
              {behavioralMetrics.stress}%
            </div>
          </div>
          <div className="telemetry-card">
            <div className="telemetry-label">Engagement Index</div>
            <div className="telemetry-value" style={{ color: behavioralMetrics.engagement < 40 ? 'var(--warning)' : 'var(--success)' }}>
              {behavioralMetrics.engagement}%
            </div>
          </div>
          <div className="telemetry-card">
            <div className="telemetry-label">Hardware Integrity</div>
            <div className="telemetry-value" style={{
              fontSize: '0.8rem',
              color: (integrityResults?.trustScore || 0) < 0.8 ? 'var(--danger)' : 'var(--success)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span>{Math.round((integrityResults?.trustScore || 1) * 100)}% Trust</span>
              <div style={{
                height: '4px',
                width: '100%',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(integrityResults?.trustScore || 1) * 100}%`,
                  background: (integrityResults?.trustScore || 1) < 0.8 ? 'var(--danger)' : 'var(--success)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-label">Environment Audit</div>
            <div className="telemetry-value" style={{
              fontSize: '0.8rem',
              color: objectResults?.isProhibited ? 'var(--danger)' : 'var(--success)'
            }}>
              {objectResults?.detectedItems.length
                ? [...new Set(objectResults.detectedItems)].slice(0, 3).join(', ').toUpperCase()
                : 'SCANNING...'}
            </div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-label">Hardware Logic</div>
            <div className="telemetry-value" style={{
              fontSize: '0.8rem',
              color: (hardwareStatus?.monitorCount || 1) > 1 ? 'var(--danger)' : 'var(--success)'
            }}>
              {hardwareStatus?.monitorCount || 1} Monitor(s) {(hardwareStatus?.monitorCount || 1) > 1 ? '⚠️' : '✅'}
            </div>
          </div>
        </div>

        <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 100, display: 'flex', gap: '0.5rem' }}>
          <button
            className="audit-btn"
            style={{ background: isSimulatingStress ? 'var(--danger)' : 'rgba(255,171,0,0.1)' }}
            onClick={() => setIsSimulatingStress(!isSimulatingStress)}
          >
            {isSimulatingStress ? 'STOP STRESS TEST' : 'SIMULATE HIGH STRESS'}
          </button>

          <button
            className="audit-btn"
            style={{ background: isDebugJitter ? 'var(--danger)' : 'rgba(255,171,0,0.1)' }}
            onClick={toggleSimulation}
          >
            {isDebugJitter ? 'STOP SIMULATION' : 'SIMULATE INTERCEPTION'}
          </button>

          <button className="audit-btn" onClick={startScreenAudit}>
            START SCREEN AUDIT
          </button>
        </div>
      </main>
    </>
  );
}

export default App;
