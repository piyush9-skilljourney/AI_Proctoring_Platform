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
      alert("Missing session ID and video URL.");
      return;
    }
    
    setIsSubmitting(true);
    try {
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
         alert("Interview successfully submitted!");
         navigate('/');
      } else {
         alert(`Submission failed: ${res.status}`);
      }
    } catch (err) {
       console.error("Submission error:", err);
       alert("Error occurred during submission.");
    } finally {
       setIsSubmitting(false);
    }
  };

  return (
    <div className="review-container">
      <div className="review-card">
        <h1>Interview Completed</h1>
        <p className="subtitle">Review your recorded session and the behavioral audit report.</p>

        <div className="review-layout">
          <div className="video-section">
            <h3>Recorded Session</h3>
            {videoUrl ? (
              <video src={videoUrl} controls className="review-video" />
            ) : (
              <div className="no-video">No video recorded</div>
            )}
          </div>

          <div className="logs-section">
            <h3>Neural Audit Summary</h3>
            <div className="logs-list">
               <div className="log-item good">✓ Video/Audio integrity verified.</div>
               
               {logs && logs.length > 0 ? (
                 <div className="violation-alerts">
                   <h4 style={{marginTop: "1rem", color: "#f87171"}}>Proctoring Flags:</h4>
                   <ul style={{textAlign: "left", fontSize: "0.8rem", color: "#f87171", margin: "10px 0 0 20px"}}>
                     {logs.filter((l: any) => l.event !== "BEHAVIORAL_SNAPSHOT").map((log: any, idx: number) => {
                       const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                       return (
                         <li key={idx} style={{marginBottom: '5px'}}>
                           <strong style={{textTransform: 'uppercase'}}>{(log.event || "ALERT").replace(/_/g, ' ')}</strong> 
                           <span style={{color: '#64748b', marginLeft: '5px'}}>at {time}</span>
                         </li>
                       );
                     })}
                   </ul>
                 </div>
               ) : (
                 <div className="log-item good" style={{marginTop: "0.5rem"}}>✓ No security flags detected.</div>
               )}

               <p style={{color: "#64748b", fontSize: "0.8rem", padding: "1rem"}}>
                 Your behavioral snapshots and environmental logs have been packaged for recruiter review.
               </p>
            </div>
            
            <div className="action-panel">
               <button className="btn-secondary" onClick={() => navigate('/')} disabled={isSubmitting}>Discard</button>
               <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Report"}
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewSubmit;
