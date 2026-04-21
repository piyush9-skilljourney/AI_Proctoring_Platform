import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FaceEngine, type DetectionResults } from './engines/FaceEngine';
import { ObjectEngine, type ObjectDetectionResults } from './engines/ObjectEngine';

const BACKEND_URL = 'http://localhost:8000';

interface AuditLog {
  id: string;
  type: string;
  message: string;
  time: string;
  severity: 'low' | 'high';
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceEngineRef = useRef<FaceEngine | null>(null);
  const objectEngineRef = useRef<ObjectEngine | null>(null);
  
  const [faceResults, setFaceResults] = useState<DetectionResults | null>(null);
  const [objectResults, setObjectResults] = useState<ObjectDetectionResults | null>(null);
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
      
      try {
        await Promise.all([faceEngine.initialize(), objectEngine.initialize()]);
        faceEngineRef.current = faceEngine;
        objectEngineRef.current = objectEngine;
        setIsReady(true);
        addLog("SYSTEM", "Neural Engines Synchronized", "low");
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
    if (!faceEngineRef.current || !objectEngineRef.current || !videoRef.current) return;

    let requestRef: number;
    let lastLogTime = 0;

    const loop = () => {
      if (videoRef.current && faceEngineRef.current && objectEngineRef.current && isReady) {
        // Skip frames if video isn't ready or dimensions are 0
        if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
          requestRef = requestAnimationFrame(loop);
          return;
        }

        try {
          const timestamp = performance.now();
          const face = faceEngineRef.current.detect(videoRef.current, timestamp);
          const objects = objectEngineRef.current.detect(videoRef.current, timestamp);
          
          setFaceResults(face);
          setObjectResults(objects);

          // Alert Handling
          const isAlert = face.isAlert || objects.isProhibited;
          const alertMsg = face.isAlert ? face.message : objects.message;

          if (isAlert && timestamp - lastLogTime > 4000) {
            addLog("VIOLATION", alertMsg, "high");
            if (sessionId) {
              axios.post(`${BACKEND_URL}/api/poc/log`, {
                session_id: sessionId,
                type: "BEHAVIORAL_AUDIT",
                details: alertMsg
              }).catch(() => {});
            }
            lastLogTime = timestamp;
          }
        } catch (err: any) {
          // If it's a specific ROI/MediaPipe error, just log and continue the loop
          if (err.message.includes("ROI")) {
            console.warn("MediaPipe ROI glitch, skipping frame...");
          } else {
            addLog("CRASH", `Loop failure: ${err.message}`, "high");
            return; // Stop for true critical crashes
          }
        }
      }
      requestRef = requestAnimationFrame(loop);
    };

    requestRef = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef);
  }, [sessionId, isReady]);

  const activeAlert = faceResults?.isAlert || objectResults?.isProhibited;

  return (
    <>
      {/* Sidebar: Audit Log */}
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

      {/* Main Viewport */}
      <main className="main-viewport">
        <div className="video-feed-container">
          <video ref={videoRef} playsInline muted />
          <div className="overlay-status">
            <div className={`dot ${activeAlert ? 'dot-alert' : 'dot-active'}`} />
            {activeAlert ? 'INTEGRITY RISK DETECTED' : 'SYSTEM SECURE'}
          </div>
        </div>

        <div className="telemetry-grid">
          <div className="telemetry-card">
            <div className="telemetry-label">Eyeball Precision (L)</div>
            <div className="telemetry-value">{(faceResults?.iris.left.x || 0.5).toFixed(2)}</div>
          </div>
          <div className="telemetry-card">
            <div className="telemetry-label">Eyeball Precision (R)</div>
            <div className="telemetry-value">{(faceResults?.iris.right.x || 0.5).toFixed(2)}</div>
          </div>
          <div className="telemetry-card">
            <div className="telemetry-label">Head Deviation (Yaw)</div>
            <div className="telemetry-value">{(faceResults?.headPose.yaw || 0).toFixed(2)}</div>
          </div>
            <div className="telemetry-value" style={{ fontSize: '0.9rem', color: objectResults?.isProhibited ? 'var(--danger)' : 'var(--success)' }}>
              {objectResults?.detectedItems.length ? objectResults.detectedItems.slice(0, 5).join(', ') : 'Scanning...'}
            </div>
        </div>
      </main>
    </>
  );
}

export default App;
