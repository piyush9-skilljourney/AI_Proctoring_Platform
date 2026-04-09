import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./ReviewSubmit.css";

const ReviewSubmit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { videoUrl, logs, sessionId } = location.state || { videoUrl: null, logs: [], sessionId: null };

  const handleSubmit = async () => {
    if (!sessionId && !videoUrl) {
      alert("Missing session ID and video URL. The backend might not be reachable or camera access failed.");
      return;
    }
    if (!sessionId) {
      alert("Missing session data. The backend failed to start the session. Is your MongoDB running?");
      return;
    }
    if (!videoUrl) {
      alert("Missing video URL. Recording might have failed or the camera was blocked.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Fetch blob from Blob URL
      const response = await fetch(videoUrl);
      const videoBlob = await response.blob();
      
      const formData = new FormData();
      formData.append("video", videoBlob, "interview.webm");
      formData.append("logsJson", JSON.stringify(logs));
      
      const res = await fetch(`http://127.0.0.1:8000/api/interviews/${sessionId}/submit`, {
          method: "POST",
          body: formData
      });
      
      if (res.ok) {
         alert("Interview successfully submitted and finalized!");
         navigate('/');
      } else {
         const errorText = await res.text();
         alert(`Submission failed. Backend returned status ${res.status}: ${errorText}`);
      }
    } catch (err) {
       console.error("Submission error:", err);
       alert("Error occurred during submission. Is the backend server running? Check console for details.");
    } finally {
       setIsSubmitting(false);
    }
  };

  return (
    <div className="review-container">
      <div className="review-card">
        <h1>Interview Completed</h1>
        <p className="subtitle">Review your recorded session and the proctoring report before submission.</p>

        <div className="review-layout">
          <div className="video-section">
            <h3>Recorded Session (Local Preview)</h3>
            {videoUrl ? (
              <video 
                src={videoUrl} 
                controls 
                className="review-video" 
                autoPlay={false}
              />
            ) : (
              <div className="no-video">No video recorded</div>
            )}
          </div>

          <div className="logs-section">
            <h3>Submission Summary</h3>
            <div className="logs-list">
               <div className="log-item good">
                 ✓ Your video and audio have been successfully processed.
               </div>
               <div className="log-item good">
                 ✓ Environmental data captured.
               </div>
               
               {logs && logs.length > 0 ? (
                 <div className="violation-alerts">
                   <h4 style={{marginTop: "1rem", color: "#f87171"}}>Proctoring Flags Detected:</h4>
                   <ul style={{textAlign: "left", fontSize: "0.9rem", color: "#f87171", margin: "10px 0 0 20px"}}>
                     {logs.map((log: any, idx: number) => {
                       const ms = log.timestamp;
                       const mins = Math.floor(ms / 60000).toString().padStart(2, '0');
                       const secs = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
                       return (
                         <li key={idx}>
                           <strong style={{textTransform: 'uppercase'}}>{log.type.replace(/_/g, ' ')}</strong> at {mins}:{secs}
                         </li>
                       );
                     })}
                   </ul>
                 </div>
               ) : (
                 <div className="log-item good" style={{marginTop: "0.5rem"}}>
                   ✓ No security flags detected during session.
                 </div>
               )}

               <p style={{color: "#64748b", fontSize: "0.9rem", padding: "1rem"}}>
                 Please submit your interview to complete the session. Your proctoring and environmental logs will be sent directly to the administrative review team.
               </p>
            </div>
            
            <div className="action-panel">
              <button className="btn-secondary" onClick={() => navigate('/')} disabled={isSubmitting}>Discard & Restart</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                 {isSubmitting ? "Submitting..." : "Submit Interview"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewSubmit;
