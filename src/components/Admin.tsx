import { useEffect, useState } from "react";
import "./Admin.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/interviews";

interface Session {
  session_id: string;
  candidate_name: string;
  status: string;
  logs: { timestamp: string; type: string; details?: string }[];
  video_path: string | null;
  video_url?: string | null;
  ai_summary?: string | null;
}

interface Job {
  id: string;
  title: string;
  description: string;
}

interface Invitation {
  id: string;
  candidate_name: string;
  candidate_email: string;
  job_type: string;
  status: string;
  link: string;
}

const Admin = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem("admin_token"));
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [activeTab, setActiveTab] = useState<"monitor" | "jobs" | "invite">("monitor");
  const [loading, setLoading] = useState(false);

  // Data
  const [sessions, setSessions] = useState<Session[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // Search/Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Forms
  const [jobForm, setJobForm] = useState({ title: "", description: "" });
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", jobId: "" });

  useEffect(() => {
    if (token) {
      setIsLoggedIn(true);
      fetchData();
    }
  }, [token, activeTab]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    const headers = { "Authorization": `Bearer ${token}` };
    try {
      if (activeTab === "monitor") {
        const res = await fetch(`${API_BASE}/sessions`, { headers });
        if (res.status === 401) handleLogout();
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      } else if (activeTab === "jobs") {
        const res = await fetch(`${API_BASE}/admin/jobs`, { headers });
        const data = await res.json();
        setJobs(Array.isArray(data) ? data : []);
      } else if (activeTab === "invite") {
        const resEnv = await fetch(`${API_BASE}/admin/interviews`, { headers });
        const dataEnv = await resEnv.json();
        setInvitations(Array.isArray(dataEnv) ? dataEnv : []);
        
        const resJobs = await fetch(`${API_BASE}/admin/jobs`, { headers });
        const dataJobs = await resJobs.json();
        const jobsArray = Array.isArray(dataJobs) ? dataJobs : [];
        setJobs(jobsArray);
        
        if (jobsArray.length > 0 && !inviteForm.jobId) {
          setInviteForm(prev => ({ ...prev, jobId: jobsArray[0].id }));
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginForm = new FormData();
    loginForm.append("username", loginData.username);
    loginForm.append("password", loginData.password);
    
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        body: loginForm,
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        localStorage.setItem("admin_token", data.access_token);
        setIsLoggedIn(true);
      } else {
        alert("Invalid credentials. Please try again.");
      }
    } catch (err) {
      alert("Login failed. Is the server running?");
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("admin_token");
    setIsLoggedIn(false);
  };

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/jobs`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify(jobForm)
      });
      if (res.ok) {
        setJobForm({ title: "", description: "" });
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const deleteJob = async (id: string) => {
    if (!confirm("Are you sure? This will not delete past interviews but will remove the position.")) return;
    await fetch(`${API_BASE}/admin/jobs/${id}`, { 
      method: 'DELETE',
      headers: { "Authorization": `Bearer ${token}` }
    });
    fetchData();
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.jobId) return alert("Select a position first");
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/interviews/create`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          candidate_name: inviteForm.name,
          candidate_email: inviteForm.email,
          job_id: inviteForm.jobId
        })
      });
      
      if (res.ok) {
        alert("Invitation successfully generated!");
        setInviteForm({ ...inviteForm, name: "", email: "" });
        fetchData();
      } else {
        const errData = await res.json().catch(() => ({ detail: "Unknown server error" }));
        alert(`Failed to create invite: ${errData.detail || res.statusText}`);
      }
    } catch (err) { 
      console.error(err); 
      alert("Network error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.session_id.includes(searchQuery)
  );

  if (!isLoggedIn) {
    return (
      <div className="admin-container login-screen">
        <div className="glass-panel invite-form-card" style={{ width: '400px', textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 className="premium-gradient-text" style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>HyrAI</h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Secure Recruiter Core v2.5</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Username</label>
              <input 
                type="text" 
                value={loginData.username} 
                onChange={(e) => setLoginData({...loginData, username: e.target.value})} 
                placeholder="Recruiter ID"
              />
            </div>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Password</label>
              <input 
                type="password" 
                value={loginData.password} 
                onChange={(e) => setLoginData({...loginData, password: e.target.value})} 
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn-premium" style={{ width: '100%', marginTop: '1rem' }}>
              Authentication
            </button>
          </form>
          <div style={{ marginTop: '2rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>
            ENCRYPTED SESSION • HYRAI PROTOCOL
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h1 className="premium-gradient-text">Command Center</h1>
          <div className="tab-switcher">
            <button className={activeTab === 'monitor' ? 'active' : ''} onClick={() => setActiveTab('monitor')}>Monitoring</button>
            <button className={activeTab === 'jobs' ? 'active' : ''} onClick={() => setActiveTab('jobs')}>Positions</button>
            <button className={activeTab === 'invite' ? 'active' : ''} onClick={() => setActiveTab('invite')}>Invitations</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
           <div style={{ textAlign: 'right', marginRight: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Logged in as</div>
              <div style={{ fontWeight: 600 }}>Admin Admin</div>
           </div>
           <button className="action-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {activeTab === 'monitor' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Sessions</div>
              <div className="stat-value">{sessions.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">System Status</div>
              <div className="stat-value" style={{ color: 'var(--success)', fontSize: '1.25rem' }}>AI ENGINES ONLINE</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Violations Flagged</div>
              <div className="stat-value" style={{ color: 'var(--error)' }}>
                {sessions.reduce((acc, s) => acc + s.logs.length, 0)}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
             <input 
                type="text" 
                className="glass-panel" 
                style={{ padding: '0.75rem 1.5rem', flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)' }}
                placeholder="Search candidate by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
             />
             <button className="btn-premium" onClick={fetchData}>
               {loading ? "Syncing..." : "Live Refresh"}
             </button>
          </div>

          <div className="sessions-table-wrapper">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Session ID</th>
                  <th>Status</th>
                  <th>Risk Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => (
                  <tr key={session.session_id}>
                    <td style={{ fontWeight: 600 }}>{session.candidate_name}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{session.session_id}</td>
                    <td>
                      <span className={`status-pill status-${session.status}`}>
                        {session.status}
                      </span>
                    </td>
                    <td onClick={() => setSelectedSession(session)} style={{ cursor: 'pointer' }}>
                      {session.logs.length > 0 ? (
                        <span className="violation-tag" title="Click for details">{session.logs.length} violations</span>
                      ) : (
                        <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>Clean</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {session.video_url && (
                          <a 
                            href={session.video_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="action-btn"
                            style={{ textDecoration: 'none' }}
                          >
                            Watch
                          </a>
                        )}
                        <button className="delete-btn" onClick={() => setSelectedSession(session)}>
                          Logs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'jobs' && (
        <div className="invitations-layout">
           <form className="invite-form-card" onSubmit={createJob}>
              <h3>Create New Position</h3>
              <div className="form-group">
                 <label>Title</label>
                 <input 
                    type="text" 
                    required 
                    value={jobForm.title} 
                    onChange={(e) => setJobForm({...jobForm, title: e.target.value})}
                    placeholder="e.g. Senior Frontend Engineer"
                 />
              </div>
              <div className="form-group">
                 <label>Job Description</label>
                 <textarea 
                    rows={5}
                    required 
                    value={jobForm.description} 
                    onChange={(e) => setJobForm({...jobForm, description: e.target.value})}
                    placeholder="Describe the role and expectations..."
                 />
              </div>
              <button type="submit" className="btn-premium" style={{ width: '100%', marginTop: '1rem' }}>
                 Create Position
              </button>
           </form>

           <div className="sessions-table-wrapper">
              <table className="sessions-table">
                 <thead>
                    <tr>
                       <th>Position Title</th>
                       <th>Description Preview</th>
                       <th>Actions</th>
                    </tr>
                 </thead>
                 <tbody>
                    {jobs.map(job => (
                      <tr key={job.id}>
                         <td style={{ fontWeight: 600 }}>{job.title}</td>
                         <td style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                            {job.description.length > 80 ? job.description.substring(0, 80) + "..." : job.description}
                         </td>
                         <td>
                            <button className="delete-btn" onClick={() => deleteJob(job.id)}>Delete</button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'invite' && (
        <div className="invitations-layout">
           <form className="invite-form-card" onSubmit={sendInvite}>
              <h3>Issue Interview Invite</h3>
              <div className="form-group">
                 <label>Candidate Name</label>
                 <input type="text" required value={inviteForm.name} onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})} />
              </div>
              <div className="form-group">
                 <label>Candidate Email</label>
                 <input type="email" required value={inviteForm.email} onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} />
              </div>
              <div className="form-group">
                 <label>Select Position</label>
                 <select required value={inviteForm.jobId} onChange={(e) => setInviteForm({...inviteForm, jobId: e.target.value})}>
                    <option value="">Choose a position...</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                 </select>
              </div>
              <button type="submit" className="btn-premium" style={{ width: '100%', marginTop: '1rem' }}>
                 Generate Invite Link
              </button>
           </form>

           <div className="sessions-table-wrapper">
              <table className="sessions-table">
                 <thead>
                    <tr>
                       <th>Candidate</th>
                       <th>Position</th>
                       <th>Status</th>
                       <th>Link</th>
                    </tr>
                 </thead>
                 <tbody>
                    {invitations.map(inv => (
                      <tr key={inv.id}>
                         <td style={{ fontWeight: 600 }}>{inv.candidate_name}</td>
                         <td>{inv.job_type}</td>
                         <td><span className={`status-pill status-${inv.status}`}>{inv.status}</span></td>
                         <td>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <code style={{ 
                                  fontSize: '0.75rem', 
                                  color: 'var(--primary)', 
                                  background: 'rgba(99, 102, 241, 0.1)', 
                                  padding: '0.4rem 0.6rem', 
                                  borderRadius: '6px', 
                                  maxWidth: '250px', 
                                  overflow: 'hidden', 
                                  border: '1px solid rgba(99, 102, 241, 0.2)',
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer'
                                }}
                                onClick={() => {
                                   navigator.clipboard.writeText(inv.link);
                                   alert("Link copied!");
                                }}>
                                  {inv.link}
                                </code>
                                <button 
                                  className="action-btn" 
                                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                                  onClick={() => {
                                    navigator.clipboard.writeText(inv.link);
                                    alert("Link copied to clipboard!");
                                  }}
                                >
                                  Copy Link
                                </button>
                             </div>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}
      {/* Violation Details Modal */}
      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal-content audit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Violation Audit: {selectedSession.candidate_name}</h3>
              <button className="close-btn" onClick={() => setSelectedSession(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {selectedSession.ai_summary && (
                <div className="ai-summary-box">
                  <h4>🧠 Neural Analytics Summary</h4>
                  <p>{selectedSession.ai_summary}</p>
                </div>
              )}
              
              <div className="audit-summary">
                <p>Total Violations: <strong>{selectedSession.logs.length}</strong></p>
                <p>Session ID: <small>{selectedSession.session_id}</small></p>
              </div>
              
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Violation Type</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSession.logs.length > 0 ? (
                    selectedSession.logs.map((log, idx) => {
                      let detailsObj: any = null;
                      if (log.type === "BEHAVIORAL_SNAPSHOT" && log.details) {
                        try { detailsObj = JSON.parse(log.details); } catch (e) {}
                      }

                      return (
                        <tr key={idx}>
                          <td>{log.timestamp}</td>
                          <td>
                            {detailsObj ? (
                              <div className="behavioral-snapshot">
                                <span className="emotion-tag">{detailsObj.emotion}</span>
                                <span className="stress-tag">Stress: {detailsObj.stress}%</span>
                              </div>
                            ) : (
                              <span className={`violation-pill ${log.type.toLowerCase()}`}>
                                {log.type.replace(/_/g, ' ')}
                              </span>
                            )}
                          </td>
                          <td>
                            {["PHONE_DETECTED", "MULTIPLE_FACES", "DUPLICATE_DISPLAY"].includes(log.type) ? (
                              <span className="severity-high">High</span>
                            ) : detailsObj ? (
                               <span className="severity-info">Insight</span>
                            ) : (
                              <span className="severity-med">Medium</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>
                        No violations recorded for this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
