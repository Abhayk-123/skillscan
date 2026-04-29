import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { MockInterviewPage } from "./addons";

const NAV_ITEMS = [
  { to: "/dashboard",     icon: "⊞", label: "Dashboard" },
  { to: "/job-match",     icon: "⌖", label: "JD Tailoring" },
  { to: "/rewrite",       icon: "✎", label: "Resume Rewrite" },
  { to: "/history",       icon: "◷", label: "Resume Versions" },
  { to: "/cover-letter",  icon: "✉", label: "Cover Letter" },
  { to: "/interview-prep",icon: "◉", label: "Interview Prep" },
  { to: "/mock-interview",icon: "🎤", label: "Mock Interview" },
  { to: "/profile",       icon: "◯", label: "Profile" },
  { to: "/pricing",       icon: "$", label: "Pricing" },
  { to: "/feedback",      icon: "★", label: "Rating & Feedback" },
];

function Layout({ user, setUser, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const doLogout = async () => {
    try { await api.logout(); } finally { setUser(null); navigate("/login"); }
  };
  const plan = (user?.plan || (user?.is_paid ? "pro" : "free")).toUpperCase();
  const freeLeft = Math.max(0, 4 - (user?.free_analyses_used || 0));
  const initial = (user?.email || "U")[0].toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-wrap">
            <div className="brand-icon">S</div>
            <span className="brand">SkillScan</span>
          </div>
        </div>

        <div className="nav-section-label">Navigation</div>
        <nav className="nav">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <Link
              key={to}
              to={to}
              className={location.pathname === to ? "active" : ""}
            >
              <span className="nav-icon">{icon}</span>
              {label}
              {location.pathname === to && <span className="nav-dot" />}
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link to="/admin" className={location.pathname === "/admin" ? "active" : ""}>
              <span className="nav-icon">⚙</span>Admin
            </Link>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-pro-card">
            <div className="pro-title">Go Pro</div>
            <div className="pro-sub">{user?.is_paid ? "Paid access enabled" : `${freeLeft} free scans left`}</div>
            {!user?.is_paid && (
              <button className="upgrade-btn" onClick={() => navigate("/pricing")}>
                Upgrade →
              </button>
            )}
          </div>
          <div className="sidebar-user">
            <div className="user-avatar">{initial}</div>
            <div className="user-info">
              <div className="user-email">{user?.email}</div>
              <div className="user-plan-badge">{plan}</div>
            </div>
            <button className="logout-btn" onClick={doLogout} title="Logout">⇥</button>
          </div>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

/* ── AUTH PAGE ────────────────────────────── */
function AuthPage({ mode, setUser }) {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const data = mode === "signup"
        ? await api.signup(form)
        : await api.login({ email: form.email, password: form.password });
      setUser(data.user); navigate("/dashboard");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const isLogin = mode === "login";

  return (
    <div className="auth-wrap">
      {/* Left panel */}
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-brand-icon">S</div>
          <span className="auth-brand-name">SkillScan</span>
        </div>
        <div className="auth-headline">
          {isLogin ? "Good to see\nyou again." : "Build your\ncareer edge."}
        </div>
        <div className="auth-subline">
          AI-powered resume intelligence for serious job seekers.
        </div>
        <div className="auth-features">
          {[
            { title: "ATS Score Analysis",   sub: "See exactly how recruiters' systems score you" },
            { title: "Skill Gap Detection",  sub: "Know what's missing before you apply" },
            { title: "Job Match AI",         sub: "Compare your resume to any job description" },
            { title: "History & Reports",    sub: "Track your improvement over time" },
          ].map((f) => (
            <div className="auth-feature" key={f.title}>
              <div className="auth-feature-check">✓</div>
              <div>
                <div className="auth-feature-title">{f.title}</div>
                <div className="auth-feature-sub">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-form-box">
          <div className="auth-form-title">{isLogin ? "Welcome back" : "Create account"}</div>
          <div className="auth-form-sub">
            {isLogin
              ? <span>New here? <Link to="/signup">Create account</Link></span>
              : <span>Already have an account? <Link to="/login">Sign in</Link></span>
            }
          </div>

          <form onSubmit={submit}>
            {!isLogin && (
              <div className="form-field">
                <label className="form-label">Username</label>
                <input placeholder="yourname" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
              </div>
            )}
            <div className="form-field">
              <label className="form-label">Email address</label>
              <input placeholder="you@example.com" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="form-label">Password</label>
              <input placeholder="••••••••" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            </div>
            {error && <div className="error-box">{error}</div>}
            <button className="auth-submit-btn" type="submit" disabled={busy}>
              ⚡ {busy ? (isLogin ? "Signing in..." : "Creating...") : (isLogin ? "Sign In" : "Create Account")}
            </button>
          </form>

          {isLogin && (
            <div className="auth-forgot">
              <Link to="/forgot-password">Forgot your password?</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ForgotPassword() {
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setError(""); setMsg(""); try { const data = await api.requestPasswordReset({ email }); setMsg(data.message); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return (
    <div className="auth-simple-wrap">
      <div className="auth-simple-card">
        <div className="auth-simple-title">Reset your password</div>
        <div className="auth-simple-sub">Enter your email and we'll send a reset link.</div>
        <form onSubmit={submit}>
          <div className="form-field"><label className="form-label">Email</label><input placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {msg && <div className="success-box">{msg}</div>}
          {error && <div className="error-box">{error}</div>}
          <button className="auth-submit-btn" type="submit" disabled={busy} style={{marginTop:12}}>{busy ? "Sending..." : "Send reset link"}</button>
        </form>
        <div className="switch-link"><Link to="/login">← Back to login</Link></div>
      </div>
    </div>
  );
}

function ResetPassword() {
  const [params] = useSearchParams(); const [password, setPassword] = useState(""); const [msg, setMsg] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setError(""); setMsg(""); try { const data = await api.resetPassword({ token: params.get("token"), password }); setMsg(data.message); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return (
    <div className="auth-simple-wrap">
      <div className="auth-simple-card">
        <div className="auth-simple-title">Choose a new password</div>
        <div className="auth-simple-sub">Make it strong.</div>
        <form onSubmit={submit}>
          <div className="form-field"><label className="form-label">New password</label><input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {msg && <div className="success-box">{msg}</div>}
          {error && <div className="error-box">{error}</div>}
          <button className="auth-submit-btn" type="submit" disabled={busy} style={{marginTop:12}}>{busy ? "Updating..." : "Update password"}</button>
        </form>
        <div className="switch-link"><Link to="/login">← Back to login</Link></div>
      </div>
    </div>
  );
}

/* ── DASHBOARD ────────────────────────────── */
function Dashboard({ user, refreshUser }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [analytics, setAnalytics] = useState({ total_analyses: 0, average_ats_score: 0, best_score: 0, common_missing_skills: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => { api.dashboardAnalytics().then(setAnalytics).catch(() => {}); }, []);

  const analyze = async () => {
    if (!file) return setError("Please select a PDF or DOCX resume.");
    const fd = new FormData(); fd.append("resume", file);
    setBusy(true); setError("");
    try {
      const data = await api.analyze(fd);
      setResult(data.result);
      await refreshUser();
      const a = await api.dashboardAnalytics();
      setAnalytics(a);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const score = result?.ats_score ?? 0;
  const plan = (user?.plan || (user?.is_paid ? "pro" : "free")).toUpperCase();
  const freeLeft = Math.max(0, 4 - (user?.free_analyses_used || 0));

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-eyebrow">AI RESUME ANALYZER</div>
          <h1>Dashboard</h1>
        </div>
        <div className="header-chips">
          <div className="header-chip">
            <span className="chip-label">PLAN</span>
            <span className="chip-value">{plan}</span>
          </div>
          <div className="header-chip">
            <span className="chip-label">FREE SCANS</span>
            <span className="chip-value">{user?.is_paid ? "∞" : freeLeft}</span>
          </div>
          <div className="header-chip">
            <span className="chip-label">ATS SCORE</span>
            <span className="chip-value">{score || "—"}</span>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="dashboard-grid">
          {/* Upload card */}
          <div className="upload-card">
            <div className="card-title">
              Upload Resume
              <div className="format-badges">
                <span className="format-badge">PDF</span>
                <span className="format-badge">·</span>
                <span className="format-badge">DOCX</span>
              </div>
            </div>

            <div
              className={`dropzone ${file ? "has-file" : ""} ${dragging ? "has-file" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("resume-file-input").click()}
            >
              <div className="dropzone-icon">↑</div>
              {file ? (
                <>
                  <div className="dropzone-text">{file.name}</div>
                  <div className="dropzone-sub">Click to change file</div>
                </>
              ) : (
                <>
                  <div className="dropzone-text">Drop your resume here</div>
                  <div className="dropzone-sub">or click to browse — PDF, DOCX supported</div>
                </>
              )}
            </div>
            <input
              id="resume-file-input"
              type="file"
              accept=".pdf,.docx"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <button className="primary-btn" onClick={analyze} disabled={busy}>
              ⚡ {busy ? "Analyzing..." : "Analyze Resume"}
            </button>
            {error && <div className="error-box">{error}</div>}

            {result && (
              <>
                <div className="success-box" style={{marginTop:14}}>Resume analyzed successfully.</div>
                <div className="result-grid">
                  <div className="result-block"><h3>Summary</h3><p>{result.summary}</p></div>
                  <div className="result-block"><h3>Strengths</h3><ul>{result.strengths?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
                  <div className="result-block"><h3>Missing skills</h3><ul>{result.missing_skills?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
                  <div className="result-block"><h3>Suggestions</h3><ul>{result.suggestions?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
                </div>
              </>
            )}

            {analytics.common_missing_skills?.length > 0 && (
              <div style={{marginTop:20}}>
                <div className="small-label" style={{marginBottom:8}}>Common skill gaps</div>
                <div className="chip-row">
                  {analytics.common_missing_skills.map((item, idx) => <span className="tag-chip" key={idx}>{item}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* ATS Score card */}
          <div className="ats-card">
            <h3>ATS Score</h3>
            {score > 0 ? (
              <>
                <div className="score-ring" style={{ "--pct": `${score}%` }}>
                  <div className="score-inner">
                    <div className="score-number">{score}</div>
                    <div className="score-label">{score >= 80 ? "Strong" : score >= 60 ? "Good" : "Needs work"}</div>
                  </div>
                </div>
                <div style={{width:"100%",marginTop:8}}>
                  <div className="stat-chip" style={{marginBottom:8}}><span>Total analyses</span><strong>{analytics.total_analyses}</strong></div>
                  <div className="stat-chip" style={{marginBottom:8}}><span>Avg score</span><strong>{analytics.average_ats_score}</strong></div>
                  <div className="stat-chip"><span>Best score</span><strong>{analytics.best_score}</strong></div>
                </div>
              </>
            ) : (
              <>
                <div className="score-bar-wrap">
                  <div className="score-bar-track"><div className="score-bar-fill" style={{width:"0%"}} /></div>
                  <div className="score-label" style={{textAlign:"center",color:"var(--muted)"}}>—</div>
                </div>
                <div className="ats-empty">Upload a resume to see your ATS compatibility and feedback.</div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── ALL OTHER PAGES — data same as v24, wrapped in new page layout ── */

function PageWrap({ eyebrow, title, children }) {
  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="page-body">{children}</div>
    </>
  );
}

function JobMatch() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [savedJds, setSavedJds] = useState([]);
  const [jdMeta, setJdMeta] = useState({ title: "", company: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.savedJds().then((d) => setSavedJds(d.items || [])).catch(() => {}); }, []);
  const submit = async () => { setBusy(true); setError(""); try { const data = await api.matchJob({ resume_text: resumeText, job_description: jobDescription }); setResult(data.result); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const saveJd = async () => { try { await api.saveJd({ ...jdMeta, description: jobDescription }); const d = await api.savedJds(); setSavedJds(d.items || []); setJdMeta({ title: "", company: "" }); } catch (err) { setError(err.message); } };
  return (
    <PageWrap eyebrow="JD TAILORING" title="Match Resume to Job">
      <div className="pricing-stack">
        <div className="card">
          <div className="two-col">
            <textarea className="text-area" placeholder="Paste your resume text" value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
            <textarea className="text-area" placeholder="Paste the job description" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
          </div>
          <div className="mini-form-row">
            <input placeholder="JD title" value={jdMeta.title} onChange={(e) => setJdMeta((p) => ({ ...p, title: e.target.value }))} />
            <input placeholder="Company" value={jdMeta.company} onChange={(e) => setJdMeta((p) => ({ ...p, company: e.target.value }))} />
            <button className="ghost-btn" onClick={saveJd}>Save JD</button>
          </div>
          <button className="primary-btn" onClick={submit} disabled={busy}>{busy ? "Analyzing..." : "⚡ Analyze JD fit"}</button>
          {busy && <div className="muted" style={{ marginTop: 10 }}>Processing JD match...</div>}
          {error && <div className="error-box">{error}</div>}
        </div>
        {!!savedJds.length && <div className="card"><div className="eyebrow">Saved JDs</div><div className="history-list">{savedJds.map((item) => <div className="history-card" key={item.id}><div className="history-top"><strong>{item.title || "Untitled JD"}</strong><span>{item.company || "Unknown company"}</span></div><p>{item.description?.slice(0, 160)}...</p></div>)}</div></div>}
        {!result && !busy && <div className="empty-state"><p>Paste resume + JD above and run analysis.</p></div>}
        {result && (
          <div className="pricing-stack">
            <div className="comparison-box"><div className="comparison-stats"><div className="stat-chip"><span>Match score</span><strong>{result.match_score}%</strong></div><div className="stat-chip"><span>Role fit</span><strong>{result.role_fit}</strong></div><div className="stat-chip"><span>Missing keywords</span><strong>{result.missing_keywords?.length || 0}</strong></div></div></div>
            <div className="result-grid">
              <div className="result-block"><h3>Matched keywords</h3><ul>{result.matched_keywords?.map((item, i) => <li key={i}>✅ {item}</li>)}</ul></div>
              <div className="result-block"><h3>Missing keywords</h3><ul>{result.missing_keywords?.map((item, i) => <li key={i}>❌ {item}</li>)}</ul></div>
              <div className="result-block"><h3>Weak sections</h3><ul>{result.weak_sections?.length ? result.weak_sections.map((item, i) => <li key={i}>{item}</li>) : <li>No obvious section gaps found.</li>}</ul></div>
              <div className="result-block"><h3>Bullets to rewrite</h3><ul>{result.bullets_to_rewrite?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
              <div className="result-block"><h3>Section fixes</h3><ul>{Object.entries(result.section_fixes || {}).map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}</ul></div>
              <div className="result-block"><h3>Suggested summary</h3><p>{result.sample_summary || result.summary}</p></div>
              <div className="result-block" style={{ gridColumn: "1 / -1" }}><h3>Rewrite suggestions</h3><ul>{result.rewrite_suggestions?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
              <div className="result-block" style={{ gridColumn: "1 / -1" }}><h3>Before / After examples</h3><div className="before-after-list">{(result.before_after_examples || []).map((item, i) => <div className="before-after-card" key={i}><div><div className="small-label">Before</div><p>{item.before}</p></div><div><div className="small-label">After</div><p>{item.after}</p></div></div>)}</div></div>
            </div>
          </div>
        )}
      </div>
    </PageWrap>
  );
}

function ResumeRewrite() {
  const [resumeText, setResumeText] = useState(""); const [jobDescription, setJobDescription] = useState(""); const [result, setResult] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async () => { setBusy(true); setError(""); try { const data = await api.rewriteResume({ resume_text: resumeText, job_description: jobDescription }); setResult(data.result); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return (
    <PageWrap eyebrow="RESUME REWRITE" title="Section-wise Improvement">
      <div className="pricing-stack">
        <div className="card">
          <div className="two-col"><textarea className="text-area" placeholder="Paste your resume text" value={resumeText} onChange={(e) => setResumeText(e.target.value)} /><textarea className="text-area" placeholder="Paste target JD (optional)" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} /></div>
          <button className="primary-btn" onClick={submit} disabled={busy}>{busy ? "Generating..." : "⚡ Generate rewrite suggestions"}</button>
          {busy && <div className="muted" style={{ marginTop: 10 }}>Generating better resume direction...</div>}
          {error && <div className="error-box">{error}</div>}
        </div>
        {!result && !busy && <div className="empty-state"><p>Paste your resume and generate rewrite suggestions.</p></div>}
        {result && <div className="result-grid"><div className="result-block"><h3>Generated summary</h3><p>{result.generated_summary}</p></div><div className="result-block"><h3>Skills to add</h3><ul>{result.skills_to_add?.map((item, i) => <li key={i}>{item}</li>)}</ul></div><div className="result-block"><h3>Section fixes</h3><ul>{Object.entries(result.section_fixes || {}).map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}</ul></div><div className="result-block"><h3>Rewrite suggestions</h3><ul>{result.rewrite_suggestions?.map((item, i) => <li key={i}>{item}</li>)}</ul></div><div className="result-block" style={{ gridColumn: "1 / -1" }}><h3>Before / After bullets</h3><div className="history-list">{result.experience_rewrites?.map((item, i) => <div className="history-card" key={i}><p><strong>Before:</strong> {item.before}</p><p><strong>After:</strong> {item.after}</p></div>)}</div></div></div>}
      </div>
    </PageWrap>
  );
}

function History() {
  const [items, setItems] = useState([]); const [error, setError] = useState("");
  useEffect(() => { api.history().then((data) => setItems(data.items || [])).catch((err) => setError(err.message)); }, []);
  const comparison = useMemo(() => {
    if ((items || []).length < 2) return null;
    const latest = items[0]; const previous = items[1];
    const latestScore = latest?.result?.ats_score || 0; const oldScore = previous?.result?.ats_score || 0;
    const improved = latestScore - oldScore;
    const oldMissing = new Set(previous?.result?.missing_skills || []); const newMissing = new Set(latest?.result?.missing_skills || []);
    const fixed = [...oldMissing].filter((x) => !newMissing.has(x)); const stillMissing = [...newMissing];
    return { latest, previous, improved, fixed, stillMissing };
  }, [items]);
  return (
    <PageWrap eyebrow="RESUME VERSIONS" title="Version Comparison">
      <div className="pricing-stack">
        <div className="card">
          {comparison ? (<><div className="comparison-box"><div className="comparison-stats"><div className="stat-chip"><span>Old ATS</span><strong>{comparison.previous.result?.ats_score || 0}</strong></div><div className="stat-chip"><span>New ATS</span><strong>{comparison.latest.result?.ats_score || 0}</strong></div><div className="stat-chip"><span>Change</span><strong>{comparison.improved >= 0 ? `+${comparison.improved}` : comparison.improved}</strong></div><div className="stat-chip"><span>Status</span><strong>{comparison.improved > 0 ? "Improved" : comparison.improved < 0 ? "Dropped" : "Flat"}</strong></div></div></div><div className="result-grid"><div className="result-block"><h3>What improved</h3><ul>{comparison.fixed.length ? comparison.fixed.map((x, i) => <li key={i}>✅ {x}</li>) : <li>No fixed gaps yet.</li>}</ul></div><div className="result-block"><h3>Still missing</h3><ul>{comparison.stillMissing.length ? comparison.stillMissing.map((x, i) => <li key={i}>❌ {x}</li>) : <li>Nothing missing.</li>}</ul></div><div className="result-block"><h3>Old strengths</h3><ul>{(comparison.previous.result?.strengths || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div><div className="result-block"><h3>New strengths</h3><ul>{(comparison.latest.result?.strengths || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div></div></>) : <div className="empty-state"><p>Need at least two analyses to compare versions.</p></div>}
          {error && <div className="error-box">{error}</div>}
        </div>
        <div className="card"><div className="eyebrow">All versions</div><div className="history-list">{items.map((item) => (<div className="history-card" key={item.id}><div className="history-top"><strong>{item.file_name || "Resume"}</strong><span>{item.created_at}</span></div><div className="history-score">ATS {item.result?.ats_score ?? "—"}</div><p>{item.result?.summary}</p><a className="inline-link" href={api.exportAnalysisUrl(item.id)} target="_blank" rel="noreferrer">Download PDF report</a></div>))}</div></div>
      </div>
    </PageWrap>
  );
}

function CoverLetter() {
  const [resumeText, setResumeText] = useState(""); const [jobDescription, setJobDescription] = useState(""); const [result, setResult] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try { const data = await api.coverLetter({ resume_text: resumeText, job_description: jobDescription }); setResult(data.result); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return (
    <PageWrap eyebrow="COVER LETTER" title="Generate Application Copy">
      <div className="card"><div className="two-col"><textarea className="text-area" placeholder="Paste resume text" value={resumeText} onChange={(e) => setResumeText(e.target.value)} /><textarea className="text-area" placeholder="Paste job description" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} /></div><button className="primary-btn" onClick={submit} disabled={busy}>{busy ? "Generating..." : "⚡ Generate cover letter"}</button>{error && <div className="error-box">{error}</div>}{result && <div className="result-grid" style={{ marginTop: 18 }}><div className="result-block" style={{ gridColumn: "1 / -1" }}><h3>Cover letter</h3><pre className="pre-block">{result.cover_letter}</pre></div><div className="result-block"><h3>Short email intro</h3><pre className="pre-block">{result.short_email_intro}</pre></div><div className="result-block"><h3>Recruiter message</h3><pre className="pre-block">{result.recruiter_message}</pre></div></div>}</div>
    </PageWrap>
  );
}

function InterviewPrep() {
  const [resumeText, setResumeText] = useState(""); const [jobDescription, setJobDescription] = useState(""); const [result, setResult] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try { const data = await api.interviewQuestions({ resume_text: resumeText, job_description: jobDescription }); setResult(data.result); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return (
    <PageWrap eyebrow="INTERVIEW PREP" title="Prepare for Your Interview">
      <div className="card"><div className="two-col"><textarea className="text-area" placeholder="Paste resume text" value={resumeText} onChange={(e) => setResumeText(e.target.value)} /><textarea className="text-area" placeholder="Paste job description" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} /></div><button className="primary-btn" onClick={submit} disabled={busy}>{busy ? "Generating..." : "⚡ Generate interview questions"}</button>{error && <div className="error-box">{error}</div>}{result && <div className="result-grid" style={{ marginTop: 18 }}><div className="result-block"><h3>Expected questions</h3><ul>{result.expected_questions?.map((q, i) => <li key={i}>{q}</li>)}</ul></div><div className="result-block"><h3>Technical questions</h3><ul>{result.technical_questions?.map((q, i) => <li key={i}>{q}</li>)}</ul></div><div className="result-block"><h3>HR questions</h3><ul>{result.hr_questions?.map((q, i) => <li key={i}>{q}</li>)}</ul></div><div className="result-block"><h3>Project questions</h3><ul>{result.project_questions?.map((q, i) => <li key={i}>{q}</li>)}</ul></div></div>}</div>
    </PageWrap>
  );
}

function ProfilePage() {
  const [profile, setProfile] = useState({
    full_name: "",
    target_role: "",
    experience_level: "",
    preferred_industry: ""
  });

  const [savedProfile, setSavedProfile] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.getProfile()
      .then((d) => {
        const loaded = d.profile || {
          full_name: "",
          target_role: "",
          experience_level: "",
          preferred_industry: ""
        };
        setProfile(loaded);
        setSavedProfile(loaded);
      })
      .catch((err) => setError(err.message));
  }, []);

  const save = async () => {
    setError("");
    setMsg("");

    try {
      await api.saveProfile(profile);
      setSavedProfile(profile);
      setMsg("Profile saved successfully.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PageWrap eyebrow="PROFILE" title="Personalize Recommendations">
      <div className="card">
        <div className="form-grid profile-grid">
          <div className="form-field">
            <label className="form-label">Full name</label>
            <input
              placeholder="Your name"
              value={profile.full_name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, full_name: e.target.value }))
              }
            />
          </div>

          <div className="form-field">
            <label className="form-label">Target role</label>
            <input
              placeholder="e.g. Software Engineer"
              value={profile.target_role}
              onChange={(e) =>
                setProfile((p) => ({ ...p, target_role: e.target.value }))
              }
            />
          </div>

          <div className="form-field">
            <label className="form-label">Experience level</label>
            <input
              placeholder="e.g. Mid-level"
              value={profile.experience_level}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  experience_level: e.target.value
                }))
              }
            />
          </div>

          <div className="form-field">
            <label className="form-label">Preferred industry</label>
            <input
              placeholder="e.g. Fintech"
              value={profile.preferred_industry}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  preferred_industry: e.target.value
                }))
              }
            />
          </div>
        </div>

        <button className="primary-btn" onClick={save} style={{ marginTop: 8 }}>
          Save profile
        </button>

        {msg && <div className="success-box">{msg}</div>}
        {error && <div className="error-box">{error}</div>}
      </div>

      {savedProfile && (
        <div className="card saved-profile-card">
          <div className="eyebrow">SAVED PROFILE</div>
          <h2>{savedProfile.full_name || "Your Profile"}</h2>

          <div className="saved-profile-grid">
            <div>
              <span>Target Role</span>
              <strong>{savedProfile.target_role || "Not added"}</strong>
            </div>

            <div>
              <span>Experience Level</span>
              <strong>{savedProfile.experience_level || "Not added"}</strong>
            </div>

            <div>
              <span>Preferred Industry</span>
              <strong>{savedProfile.preferred_industry || "Not added"}</strong>
            </div>
          </div>
        </div>
      )}
    </PageWrap>
  );
}

function FeedbackPage() {
  const [rating, setRating] = useState(0); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState("");
  const submit = async () => { if (!rating) return setDone("Please choose a rating first."); setBusy(true); setDone(""); try { await api.submitFeedback({ rating, message }); setDone("Thanks for your feedback."); setMessage(""); setRating(0); } catch (err) { setDone(err.message); } finally { setBusy(false); } };
  return (
    <PageWrap eyebrow="FEEDBACK" title="Rate Your Experience">
      <div className="card"><p className="muted">Share what is working well and what should improve.</p><div className="star-row">{[1, 2, 3, 4, 5].map((star) => <button key={star} className={`star-btn ${star <= rating ? "star-active" : ""}`} onClick={() => setRating(star)} type="button">★</button>)}</div><textarea className="text-area compact-area" placeholder="Write your feedback..." value={message} onChange={(e) => setMessage(e.target.value)} /><button className="primary-btn" onClick={submit} disabled={busy} style={{marginTop:8}}>{busy ? "Submitting..." : "Submit feedback"}</button>{done && <div className="success-box">{done}</div>}</div>
    </PageWrap>
  );
}

function Pricing({ user, refreshUser }) {
  const [pricing, setPricing] = useState(null); const [plans, setPlans] = useState([]); const [currentSub, setCurrentSub] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const loadPlans = async () => { const pricingData = await api.pricing(); const planData = await api.subscriptionPlans(); const subData = await api.currentSubscription().catch(() => ({ subscription: null })); setPricing(pricingData); setPlans(planData.plans || []); setCurrentSub(subData.subscription || null); };
  useEffect(() => { loadPlans().catch((err) => setError(err.message)); }, []);
  const upgradeOneTimePro = async () => { setBusy(true); setError(""); try { const order = await api.createOrder(); if (!window.Razorpay) throw new Error("Razorpay script not loaded."); const options = { key: import.meta.env.VITE_RAZORPAY_KEY_ID || order.key, amount: order.amount, currency: order.currency, name: order.name, description: order.description, order_id: order.order_id, prefill: order.prefill, theme: { color: "#00d4ff" }, modal: { ondismiss: () => setBusy(false) }, handler: async function (response) { try { await api.verifyPayment(response); await refreshUser(); alert("Payment successful. Pro activated."); } catch (err) { setError(err.message); } finally { setBusy(false); } } }; const razorpay = new window.Razorpay(options); razorpay.open(); } catch (err) { setError(err.message); setBusy(false); } };
  const createSubscription = async (planCode) => { try { const data = await api.createSubscription({ plan_code: planCode }); if (data.short_url) window.open(data.short_url, "_blank", "noopener,noreferrer"); else alert("Subscription created: " + data.plan_code); await loadPlans(); } catch (err) { setError(err.message); } };
  const standardPlans = plans.filter((p) => p.feature_level === "standard");
  const proPlans = plans.filter((p) => p.feature_level === "pro");
  return (
    <PageWrap eyebrow="PRICING" title="Choose Your Plan">
      <div className="pricing-stack">
        {currentSub && <div className="card"><div className="eyebrow">Current subscription</div><h2>{currentSub.plan_code}</h2><div className="muted">Status: {currentSub.status}</div><div className="muted">Started: {currentSub.started_at || "—"}</div><div className="muted">Expires: {currentSub.expires_at || "—"}</div></div>}
        <div className="pricing-grid three-tier-grid">
          <div className="price-card"><div className="eyebrow">Free</div><h2>₹0</h2><p>4 free resume analyses</p><ul><li>4 total analyses</li><li>ATS score + suggestions</li><li>History + comparison</li></ul></div>
          <div className="price-card"><div className="eyebrow">Standard</div><h2>₹199 / ₹1999</h2><p>Unlimited resume analysis</p><ul><li>Unlimited ATS scans</li><li>Version comparison</li><li>Cover letter + interview prep</li></ul>{standardPlans.length ? <div className="subscription-list single-col-list">{standardPlans.map((plan) => <div key={plan.code} className="subscription-card"><strong>{plan.name}</strong><div className="muted">₹{plan.price_inr} / {plan.billing_cycle}</div><button className="ghost-btn" onClick={() => createSubscription(plan.code)}>Choose {plan.name}</button></div>)}</div> : <div className="error-box">Standard plans not loading.</div>}</div>
          <div className="price-card highlight"><div className="eyebrow">Pro</div><h2>₹499 / ₹5499</h2><p>Premium tools + PDF export</p><ul><li>Everything in Standard</li><li>JD tailoring + gap analysis</li><li>PDF export</li></ul>{proPlans.length ? <div className="subscription-list single-col-list">{proPlans.map((plan) => <div key={plan.code} className="subscription-card"><strong>{plan.name}</strong><div className="muted">₹{plan.price_inr} / {plan.billing_cycle}</div><button className="ghost-btn" onClick={() => createSubscription(plan.code)}>Choose {plan.name}</button></div>)}</div> : <div className="error-box">Pro plans not loading.</div>}{!user?.is_paid ? <button className="primary-btn" onClick={upgradeOneTimePro} disabled={busy} style={{marginTop:12}}>{busy ? "Opening checkout..." : `One-time Pro unlock${pricing ? ` · ₹${pricing.one_time_pro_price_inr}` : ""}`}</button> : <div className="success-box">You already have paid access.</div>}</div>
        </div>
        {error && <div className="error-box">{error}</div>}
      </div>
    </PageWrap>
  );
}

function Admin() {
  const [data, setData] = useState(null); const [plans, setPlans] = useState([]); const [feedback, setFeedback] = useState([]); const [analytics, setAnalytics] = useState(null); const [error, setError] = useState("");
  const [form, setForm] = useState({ code: "standard_monthly", name: "Standard Monthly", period: "monthly", interval_count: 1, amount_inr: 199, currency: "INR", description: "Standard monthly subscription plan" });
  const load = async () => { try { const [overview, planData, feedbackData, analyticsData] = await Promise.all([api.adminOverview(), api.adminListRazorpayPlans(), api.adminFeedback().catch(() => ({ items: [] })), api.adminFeedbackAnalytics().catch(() => null)]); setData(overview); setPlans(planData.plans || []); setFeedback(feedbackData.items || []); setAnalytics(analyticsData); } catch (err) { setError(err.message); } };
  useEffect(() => { load(); }, []);
  const createPlan = async (e) => { e.preventDefault(); setError(""); try { await api.adminCreateRazorpayPlan(form); await load(); alert("Razorpay plan created and saved."); } catch (err) { setError(err.message); } };
  const togglePlan = async (plan) => { try { if (plan.active) await api.adminDeactivateRazorpayPlan(plan.id); else await api.adminActivateRazorpayPlan(plan.id); await load(); } catch (err) { setError(err.message); } };
  if (!data) return <div className="loader-screen">Loading admin data...</div>;
  return (
    <PageWrap eyebrow="ADMIN" title="Admin Panel">
      <div className="pricing-stack">
        <div className="pricing-grid admin-stats-grid"><div className="card"><div className="eyebrow">Users</div><h2>{data.stats.users}</h2></div><div className="card"><div className="eyebrow">Paid users</div><h2>{data.stats.paid_users}</h2></div><div className="card"><div className="eyebrow">Analyses</div><h2>{data.stats.analyses}</h2></div><div className="card"><div className="eyebrow">Subscriptions</div><h2>{data.stats.subscriptions}</h2></div><div className="card"><div className="eyebrow">Feedback</div><h2>{analytics?.count ?? data.stats.feedback_count ?? 0}</h2></div><div className="card"><div className="eyebrow">Avg rating</div><h2>{analytics?.average_rating ?? 0}</h2></div></div>
        {analytics?.common_topics?.length ? <div className="card"><div className="eyebrow">Common complaints</div><div className="chip-row">{analytics.common_topics.map((x, i) => <span className="tag-chip" key={i}>{x.topic} ({x.count})</span>)}</div></div> : null}
        <div className="card"><div className="eyebrow">Create Razorpay plan</div><h2>Build Standard or Pro plans</h2><form className="form-grid admin-plan-form" onSubmit={createPlan}><input placeholder="Code" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} /><input placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /><select value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))}><option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="yearly">yearly</option></select><input type="number" placeholder="Interval count" value={form.interval_count} onChange={(e) => setForm((p) => ({ ...p, interval_count: e.target.value }))} /><input type="number" step="0.01" placeholder="Amount INR" value={form.amount_inr} onChange={(e) => setForm((p) => ({ ...p, amount_inr: e.target.value }))} /><input placeholder="Currency" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} /><input className="admin-plan-description" placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /><button className="primary-btn" type="submit">Create plan</button></form>{error && <div className="error-box">{error}</div>}</div>
        <div className="card"><div className="eyebrow">Saved Razorpay plans</div><div className="table-wrap"><table className="admin-table"><thead><tr><th>Code</th><th>Name</th><th>Provider Plan ID</th><th>Cycle</th><th>Amount</th><th>Currency</th><th>Active</th><th>Action</th></tr></thead><tbody>{plans.map((p) => <tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td>{p.provider_plan_id}</td><td>{p.interval_count} {p.period}</td><td>₹{(p.amount / 100).toFixed(2)}</td><td>{p.currency}</td><td>{p.active ? "Yes" : "No"}</td><td><button className="ghost-btn" onClick={() => togglePlan(p)}>{p.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div></div>
        <div className="card"><div className="eyebrow">Latest feedback</div><div className="history-list">{feedback.length ? feedback.map((item) => <div className="history-card" key={item.id}><div className="history-top"><strong>{item.email}</strong><span>{item.created_at}</span></div><div className="history-score">Rating {item.rating}/5</div><p>{item.message || "No written feedback."}</p></div>) : <div className="empty-state"><p>No feedback submitted yet.</p></div>}</div></div>
      </div>
    </PageWrap>
  );
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const refreshUser = async () => { const data = await api.getMe(); setUser(data.user); return data.user; };
  useEffect(() => { refreshUser().catch(() => setUser(null)); }, []);
  if (user === undefined) return <div className="loader-screen">Loading SkillScan...</div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <AuthPage mode="login" setUser={setUser} />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <AuthPage mode="signup" setUser={setUser} />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" /> : <ForgotPassword />} />
      <Route path="/reset-password" element={user ? <Navigate to="/dashboard" /> : <ResetPassword />} />
      <Route path="/dashboard" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><Dashboard user={user} refreshUser={refreshUser} /></Layout></ProtectedRoute>} />
      <Route path="/job-match" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><JobMatch /></Layout></ProtectedRoute>} />
      <Route path="/rewrite" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><ResumeRewrite /></Layout></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><History /></Layout></ProtectedRoute>} />
      <Route path="/cover-letter" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><CoverLetter /></Layout></ProtectedRoute>} />
      <Route path="/interview-prep" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><InterviewPrep /></Layout></ProtectedRoute>} />
      <Route path="/mock-interview" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><MockInterviewPage /></Layout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><ProfilePage /></Layout></ProtectedRoute>} />
      <Route path="/pricing" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><Pricing user={user} refreshUser={refreshUser} /></Layout></ProtectedRoute>} />
      <Route path="/feedback" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><FeedbackPage /></Layout></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><Admin /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}