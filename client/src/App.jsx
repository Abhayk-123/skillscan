import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { MockInterviewPage, DsaArenaPage } from "./addons";

function Layout({ user, setUser, children }) {
  const navigate = useNavigate();
  const doLogout = async () => {
    try { await api.logout(); } finally { setUser(null); navigate("/login"); }
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-wrap">
          <div className="brand-orb" />
          <div>
            <div className="brand">SkillScan</div>
            <div className="muted">Resume AI SaaS Suite</div>
          </div>
        </div>
        <nav className="nav">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/job-match">JD Tailoring</Link>
          <Link to="/rewrite">Resume Rewrite</Link>
          <Link to="/history">Resume Versions</Link>
          <Link to="/cover-letter">Cover Letter</Link>
          <Link to="/interview-prep">Interview Prep</Link>
          <Link to="/mock-interview">Mock Interview</Link>
          <Link to="/dsa-arena">DSA Arena</Link>
          <Link to="/profile">Profile</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/feedback">Rating & Feedback</Link>
          {user?.role === "admin" ? <Link to="/admin">Admin</Link> : null}
        </nav>
        <div className="sidebar-card glow-card">
          <div className="small-label">Current plan</div>
          <div className="plan-badge">{(user?.plan || (user?.is_paid ? "pro" : "free")).toUpperCase()}</div>
          {!user?.is_paid ? <div className="small-text">{Math.max(0, 4 - (user?.free_analyses_used || 0))} free analyses left</div> : <div className="small-text">Paid access enabled</div>}
          <div className="small-text">{user?.email_verified ? "✅ Email verified" : "⚠️ Email not verified"}</div>
          <div className="small-text">Role: {user?.role}</div>
        </div>
        <button className="ghost-btn" onClick={doLogout}>Logout</button>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function AuthPage({ mode, setUser }) {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const data = mode === "signup" ? await api.signup(form) : await api.login({ email: form.email, password: form.password });
      setUser(data.user); navigate("/dashboard");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="auth-wrap">
      <div className="auth-card glow-card">
        <div className="eyebrow">{mode === "signup" ? "Get started" : "Welcome back"}</div>
        <h1>{mode === "signup" ? "Build stronger resumes with AI." : "Login to continue."}</h1>
        <p className="muted">Resume analyzer, JD matcher, resume rewriter, cover letter builder, and interview prep in one place.</p>
        <form onSubmit={submit} className="form-grid">
          {mode === "signup" ? <input placeholder="Username" value={form.username} onChange={(e)=>setForm((p)=>({...p,username:e.target.value}))} /> : null}
          <input placeholder="Email" type="email" value={form.email} onChange={(e)=>setForm((p)=>({...p,email:e.target.value}))} />
          <input placeholder="Password" type="password" value={form.password} onChange={(e)=>setForm((p)=>({...p,password:e.target.value}))} />
          {error ? <div className="error-box">{error}</div> : null}
          <button className="primary-btn" type="submit" disabled={busy}>{busy ? (mode === "signup" ? "Creating..." : "Logging in...") : (mode === "signup" ? "Create account" : "Login")}</button>
        </form>
        <div className="switch-link">
          {mode === "signup" ? <Link to="/login">Already have an account?</Link> : <Link to="/signup">Create a new account</Link>}
          {mode === "login" ? <div style={{ marginTop: 8 }}><Link to="/forgot-password">Forgot password?</Link></div> : null}
        </div>
      </div>
    </div>
  );
}

function ForgotPassword() {
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setError(""); setMsg(""); try { const data = await api.requestPasswordReset({ email }); setMsg(data.message); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <div className="auth-wrap"><div className="auth-card"><div className="eyebrow">Recovery</div><h1>Reset your password</h1><form className="form-grid" onSubmit={submit}><input placeholder="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />{msg ? <div className="success-box">{msg}</div> : null}{error ? <div className="error-box">{error}</div> : null}<button className="primary-btn" type="submit" disabled={busy}>{busy ? "Sending..." : "Send reset link"}</button></form><div className="switch-link"><Link to="/login">Back to login</Link></div></div></div>;
}

function ResetPassword() {
  const [params] = useSearchParams(); const [password, setPassword] = useState(""); const [msg, setMsg] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setError(""); setMsg(""); try { const data = await api.resetPassword({ token: params.get("token"), password }); setMsg(data.message); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <div className="auth-wrap"><div className="auth-card"><div className="eyebrow">Security</div><h1>Choose a new password</h1><form className="form-grid" onSubmit={submit}><input placeholder="New password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />{msg ? <div className="success-box">{msg}</div> : null}{error ? <div className="error-box">{error}</div> : null}<button className="primary-btn" type="submit" disabled={busy}>{busy ? "Updating..." : "Update password"}</button></form><div className="switch-link"><Link to="/login">Back to login</Link></div></div></div>;
}

function Dashboard({ user, refreshUser }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [analytics, setAnalytics] = useState({ total_analyses: 0, average_ats_score: 0, best_score: 0, common_missing_skills: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const score = result?.ats_score ?? 0;
  const scoreLabel = React.useMemo(() => score >= 80 ? "Strong" : score >= 60 ? "Good" : score > 0 ? "Needs work" : "Awaiting upload", [score]);

  useEffect(() => { api.dashboardAnalytics().then(setAnalytics).catch(()=>{}); }, []);

  const analyze = async () => {
    if (!file) return setError("Please select a PDF or DOCX resume.");
    const fd = new FormData();
    fd.append("resume", file);
    setBusy(true); setError("");
    try {
      const data = await api.analyze(fd);
      setResult(data.result);
      await refreshUser();
      const a = await api.dashboardAnalytics();
      setAnalytics(a);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="page-grid">
      <section className="hero card glow-card">
        <div>
          <div className="eyebrow">Dashboard</div>
          <h1>Resume Analyzer + Rewriter + Interview Prep</h1>
          <p className="muted">Upload your resume, get ATS insights, tailor it for jobs, generate cover letters, and prepare for interviews.</p>
        </div>
        <div className="stats-row">
          <div className="stat-chip"><span>Total analyses</span><strong>{analytics.total_analyses}</strong></div>
          <div className="stat-chip"><span>Average score</span><strong>{analytics.average_ats_score}</strong></div>
          <div className="stat-chip"><span>Best score</span><strong>{analytics.best_score}</strong></div>
          <div className="stat-chip"><span>Result quality</span><strong>{scoreLabel}</strong></div>
        </div>
      </section>

      <section className="card">
        <div className="eyebrow">Quick start</div>
        <h2>Use the app in this order</h2>
        <div className="onboarding-grid">
          <div className="onboarding-item">Upload a PDF or DOCX resume to get your ATS score.</div>
          <div className="onboarding-item">Use JD Tailoring to match your resume to a job.</div>
          <div className="onboarding-item">Rewrite your resume with AI suggestions.</div>
          <div className="onboarding-item">Generate cover letters and prep for interviews.</div>
        </div>
      </section>

      <section className="upload-panel card">
        <div className="eyebrow">Resume Analysis</div>
        <h2>Scan a new version</h2>
        <input className="file-input" type="file" accept=".pdf,.docx" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
        <div className="muted file-pill">{file ? `Selected: ${file.name}` : "No file selected yet"}</div>
        <button className="primary-btn" onClick={analyze} disabled={busy}>{busy ? "Analyzing..." : "Analyze resume"}</button>
        {error ? <div className="error-box">{error}</div> : null}
      </section>

      <section className="result-panel card">
        <div className="result-head">
          <div><div className="eyebrow">Latest result</div><h2>ATS overview</h2></div>
          <div className="score-ring" style={{ "--pct": `${score}%` }}><div className="score-inner"><div>{score}</div><span>{scoreLabel}</span></div></div>
        </div>
        {!result ? <div className="empty-state"><p>Upload a resume to see strengths, missing skills, and rewrite ideas.</p></div> : (
          <>
            <div className="success-box">Resume analyzed successfully.</div>
            <div className="result-grid">
              <div className="result-block"><h3>Summary</h3><p>{result.summary}</p></div>
              <div className="result-block"><h3>Strengths</h3><ul>{result.strengths?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
              <div className="result-block"><h3>Missing skills</h3><ul>{result.missing_skills?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
              <div className="result-block"><h3>Rewrite suggestions</h3><ul>{result.suggestions?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="eyebrow">Most common gaps</div>
        <h2>What users usually miss</h2>
        <div className="chip-row">{analytics.common_missing_skills?.length ? analytics.common_missing_skills.map((item, idx)=><span className="tag-chip" key={idx}>{item}</span>) : <span className="muted">No missing-skill data yet.</span>}</div>
      </section>
    </div>
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
  useEffect(()=>{ api.savedJds().then((d)=>setSavedJds(d.items || [])).catch(()=>{}); },[]);
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const data = await api.matchJob({ resume_text: resumeText, job_description: jobDescription });
      setResult(data.result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const saveJd = async () => {
    try {
      await api.saveJd({ ...jdMeta, description: jobDescription });
      const d = await api.savedJds(); setSavedJds(d.items || []);
      setJdMeta({ title: "", company: "" });
    } catch (err) { setError(err.message); }
  };
  return (
    <div className="pricing-stack">
      <div className="card glow-card">
        <div className="eyebrow">JD Tailoring</div>
        <h1>Match your resume with a job description</h1>
        <p className="muted">Find missing keywords, weak sections, rewrite targets, and a stronger role-focused direction.</p>
        <div className="two-col">
          <textarea className="text-area" placeholder="Paste your resume text" value={resumeText} onChange={(e)=>setResumeText(e.target.value)} />
          <textarea className="text-area" placeholder="Paste the job description" value={jobDescription} onChange={(e)=>setJobDescription(e.target.value)} />
        </div>
        <div className="mini-form-row">
          <input placeholder="JD title" value={jdMeta.title} onChange={(e)=>setJdMeta((p)=>({...p,title:e.target.value}))} />
          <input placeholder="Company" value={jdMeta.company} onChange={(e)=>setJdMeta((p)=>({...p,company:e.target.value}))} />
          <button className="ghost-btn" onClick={saveJd}>Save JD</button>
        </div>
        <button className="primary-btn" onClick={submit} disabled={busy}>{busy ? "Analyzing..." : "Analyze JD fit"}</button>
        {busy ? <div className="muted" style={{marginTop:12}}>⏳ Processing JD match...</div> : null}
        {error ? <div className="error-box">{error}</div> : null}
      </div>

      {!!savedJds.length && (
        <div className="card">
          <div className="eyebrow">Saved job descriptions</div>
          <div className="history-list">
            {savedJds.map((item)=><div className="history-card" key={item.id}><div className="history-top"><strong>{item.title || "Untitled JD"}</strong><span>{item.company || "Unknown company"}</span></div><p>{item.description?.slice(0,160)}...</p></div>)}
          </div>
        </div>
      )}

      {!result && !busy ? <div className="empty-state"><p>No JD analysis yet. Paste resume + JD and run analysis.</p></div> : null}

      {result ? (
        <div className="pricing-stack">
          <div className="comparison-box">
            <div className="comparison-stats">
              <div className="stat-chip"><span>Match score</span><strong>{result.match_score}%</strong></div>
              <div className="stat-chip"><span>Role fit</span><strong>{result.role_fit}</strong></div>
              <div className="stat-chip"><span>Missing keywords</span><strong>{result.missing_keywords?.length || 0}</strong></div>
            </div>
          </div>
          <div className="result-grid">
            <div className="result-block"><h3>Matched keywords</h3><ul>{result.matched_keywords?.map((item, i) => <li key={i}>✅ {item}</li>)}</ul></div>
            <div className="result-block"><h3>Missing keywords</h3><ul>{result.missing_keywords?.map((item, i) => <li key={i}>❌ {item}</li>)}</ul></div>
            <div className="result-block"><h3>Weak sections</h3><ul>{result.weak_sections?.length ? result.weak_sections.map((item, i) => <li key={i}>{item}</li>) : <li>No obvious section gaps found.</li>}</ul></div>
            <div className="result-block"><h3>Bullets to rewrite</h3><ul>{result.bullets_to_rewrite?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
            <div className="result-block"><h3>Section fixes</h3><ul>{Object.entries(result.section_fixes || {}).map(([k,v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}</ul></div>
            <div className="result-block"><h3>Suggested summary</h3><p>{result.sample_summary || result.summary}</p></div>
            <div className="result-block" style={{ gridColumn: "1 / -1" }}><h3>Stronger rewrite suggestions</h3><ul>{result.rewrite_suggestions?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
            <div className="result-block" style={{ gridColumn: "1 / -1" }}><h3>Before / after bullet examples</h3><div className="before-after-list">{(result.before_after_examples || []).map((item, i) => <div className="before-after-card" key={i}><div><div className="small-label">Before</div><p>{item.before}</p></div><div><div className="small-label">After</div><p>{item.after}</p></div></div>)}</div></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


function ResumeRewrite() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.rewriteResume({ resume_text: resumeText, job_description: jobDescription });
      setResult(data.result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pricing-stack">
      <div className="card glow-card">
        <div className="eyebrow">Resume Rewrite</div>
        <h1>Section-wise resume improvement</h1>
        <p className="muted">Paste your resume and optional JD to get stronger summary, better experience phrasing, and skill additions.</p>
        <div className="two-col">
          <textarea className="text-area" placeholder="Paste your resume text" value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
          <textarea className="text-area" placeholder="Paste target job description (optional)" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
        </div>
        <button className="primary-btn" onClick={submit} disabled={busy}>{busy ? "Generating..." : "Generate rewrite suggestions"}</button>
        {busy ? <div className="muted" style={{marginTop:12}}>⏳ Generating better resume direction...</div> : null}
        {error ? <div className="error-box">{error}</div> : null}
      </div>

      {!result && !busy ? <div className="empty-state"><p>No rewrite suggestions yet. Paste your resume and generate them.</p></div> : null}

      {result ? (
        <div className="result-grid">
          <div className="result-block"><h3>Generated summary</h3><p>{result.generated_summary}</p></div>
          <div className="result-block"><h3>Skills to add</h3><ul>{result.skills_to_add?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
          <div className="result-block"><h3>Section fixes</h3><ul>{Object.entries(result.section_fixes || {}).map(([k,v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}</ul></div>
          <div className="result-block"><h3>Rewrite suggestions</h3><ul>{result.rewrite_suggestions?.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
          <div className="result-block" style={{gridColumn:"1 / -1"}}><h3>Before / After experience bullets</h3><div className="history-list">{result.experience_rewrites?.map((item, i)=><div className="history-card" key={i}><p><strong>Before:</strong> {item.before}</p><p><strong>After:</strong> {item.after}</p></div>)}</div></div>
        </div>
      ) : null}
    </div>
  );
}

function History() {
  const [items, setItems] = useState([]); const [error, setError] = useState("");
  useEffect(() => { api.history().then((data) => setItems(data.items || [])).catch((err) => setError(err.message)); }, []);
  const comparison = useMemo(() => {
    if ((items || []).length < 2) return null;
    const latest = items[0]; const previous = items[1];
    const latestScore = latest?.result?.ats_score || 0;
    const oldScore = previous?.result?.ats_score || 0;
    const improved = latestScore - oldScore;
    const oldMissing = new Set(previous?.result?.missing_skills || []);
    const newMissing = new Set(latest?.result?.missing_skills || []);
    const fixed = [...oldMissing].filter((x) => !newMissing.has(x));
    const stillMissing = [...newMissing];
    return { latest, previous, improved, fixed, stillMissing };
  }, [items]);

  return (
    <div className="pricing-stack">
      <div className="card glow-card">
        <div className="eyebrow">Resume Version Comparison</div>
        <h1>Compare resume versions</h1>
        <p className="muted">Track ATS growth, see what improved, and identify what still needs work.</p>
        {comparison ? (
          <>
            <div className="comparison-box">
              <div className="comparison-stats">
                <div className="stat-chip"><span>Old ATS</span><strong>{comparison.previous.result?.ats_score || 0}</strong></div>
                <div className="stat-chip"><span>New ATS</span><strong>{comparison.latest.result?.ats_score || 0}</strong></div>
                <div className="stat-chip"><span>Score change</span><strong>{comparison.improved >= 0 ? `+${comparison.improved}` : comparison.improved}</strong></div>
                <div className="stat-chip"><span>Status</span><strong>{comparison.improved > 0 ? "Improved" : comparison.improved < 0 ? "Dropped" : "Flat"}</strong></div>
              </div>
            </div>
            <div className="result-grid">
              <div className="result-block"><h3>What improved</h3><ul>{comparison.fixed.length ? comparison.fixed.map((x, i)=><li key={i}>✅ {x}</li>) : <li>No fixed gaps yet.</li>}</ul></div>
              <div className="result-block"><h3>What is still missing</h3><ul>{comparison.stillMissing.length ? comparison.stillMissing.map((x, i)=><li key={i}>❌ {x}</li>) : <li>No active missing skills.</li>}</ul></div><div className="result-block"><h3>Old strengths</h3><ul>{(comparison.previous.result?.strengths || []).map((x,i)=><li key={i}>{x}</li>)}</ul></div><div className="result-block"><h3>New strengths</h3><ul>{(comparison.latest.result?.strengths || []).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
            </div>
          </>
        ) : <div className="empty-state"><p>Need at least two analyses to compare versions.</p></div>}
      </div>

      <div className="card">
        <div className="eyebrow">All resume versions</div>
        <div className="history-list">
          {items.map((item) => (
            <div className="history-card" key={item.id}>
              <div className="history-top"><strong>{item.file_name || "Resume"}</strong><span>{item.created_at}</span></div>
              <div className="history-score">ATS {item.result?.ats_score ?? "-"}</div>
              <p>{item.result?.summary}</p>
              <a className="inline-link" href={api.exportAnalysisUrl(item.id)} target="_blank" rel="noreferrer">Download PDF report</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoverLetter() {
  const [resumeText, setResumeText] = useState(""); const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try { const data = await api.coverLetter({ resume_text: resumeText, job_description: jobDescription }); setResult(data.result); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return (
    <div className="card">
      <div className="eyebrow">Cover Letter Generator</div>
      <h1>Generate application copy from resume + JD</h1>
      <div className="two-col">
        <textarea className="text-area" placeholder="Paste resume text" value={resumeText} onChange={(e)=>setResumeText(e.target.value)} />
        <textarea className="text-area" placeholder="Paste job description" value={jobDescription} onChange={(e)=>setJobDescription(e.target.value)} />
      </div>
      <button className="primary-btn" onClick={submit} disabled={busy}>{busy ? "Generating..." : "Generate cover letter"}</button>
      {error ? <div className="error-box">{error}</div> : null}
      {result ? <div className="result-grid" style={{ marginTop: 18 }}>
        <div className="result-block" style={{ gridColumn: "1 / -1" }}><h3>Cover letter</h3><pre className="pre-block">{result.cover_letter}</pre></div>
        <div className="result-block"><h3>Short email intro</h3><pre className="pre-block">{result.short_email_intro}</pre></div>
        <div className="result-block"><h3>Recruiter message</h3><pre className="pre-block">{result.recruiter_message}</pre></div>
      </div> : null}
    </div>
  );
}

function InterviewPrep() {
  const [resumeText, setResumeText] = useState(""); const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try { const data = await api.interviewQuestions({ resume_text: resumeText, job_description: jobDescription }); setResult(data.result); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return (
    <div className="card">
      <div className="eyebrow">Interview Questions Generator</div>
      <h1>Prepare for your next interview</h1>
      <div className="two-col">
        <textarea className="text-area" placeholder="Paste resume text" value={resumeText} onChange={(e)=>setResumeText(e.target.value)} />
        <textarea className="text-area" placeholder="Paste job description" value={jobDescription} onChange={(e)=>setJobDescription(e.target.value)} />
      </div>
      <button className="primary-btn" onClick={submit} disabled={busy}>{busy ? "Generating..." : "Generate interview questions"}</button>
      {error ? <div className="error-box">{error}</div> : null}
      {result ? <div className="result-grid" style={{ marginTop: 18 }}>
        <div className="result-block"><h3>Expected questions</h3><ul>{result.expected_questions?.map((q, i)=><li key={i}>{q}</li>)}</ul></div>
        <div className="result-block"><h3>Technical questions</h3><ul>{result.technical_questions?.map((q, i)=><li key={i}>{q}</li>)}</ul></div>
        <div className="result-block"><h3>HR questions</h3><ul>{result.hr_questions?.map((q, i)=><li key={i}>{q}</li>)}</ul></div>
        <div className="result-block"><h3>Project questions</h3><ul>{result.project_questions?.map((q, i)=><li key={i}>{q}</li>)}</ul></div>
      </div> : null}
    </div>
  );
}

function ProfilePage() {
  const [profile, setProfile] = useState({ full_name: "", target_role: "", experience_level: "", preferred_industry: "" });
  const [msg, setMsg] = useState(""); const [error, setError] = useState("");
  useEffect(()=>{ api.getProfile().then((d)=>setProfile(d.profile || profile)).catch((err)=>setError(err.message)); },[]);
  const save = async () => { setError(""); setMsg(""); try { await api.saveProfile(profile); setMsg("Profile saved successfully."); } catch (err) { setError(err.message); } };
  return (
    <div className="card">
      <div className="eyebrow">User Profile</div>
      <h1>Personalize your recommendations</h1>
      <div className="form-grid profile-grid">
        <input placeholder="Full name" value={profile.full_name} onChange={(e)=>setProfile((p)=>({...p, full_name:e.target.value}))} />
        <input placeholder="Target role" value={profile.target_role} onChange={(e)=>setProfile((p)=>({...p, target_role:e.target.value}))} />
        <input placeholder="Experience level" value={profile.experience_level} onChange={(e)=>setProfile((p)=>({...p, experience_level:e.target.value}))} />
        <input placeholder="Preferred industry" value={profile.preferred_industry} onChange={(e)=>setProfile((p)=>({...p, preferred_industry:e.target.value}))} />
      </div>
      <button className="primary-btn" onClick={save}>Save profile</button>
      {msg ? <div className="success-box">{msg}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
    </div>
  );
}

function FeedbackPage() {
  const [rating, setRating] = useState(0); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState("");
  const submit = async () => { if (!rating) return setDone("Please choose a rating first."); setBusy(true); setDone(""); try { await api.submitFeedback({ rating, message }); setDone("Thanks for your feedback."); setMessage(""); setRating(0); } catch (err) { setDone(err.message); } finally { setBusy(false); } };
  return (
    <div className="card">
      <div className="eyebrow">Rating & Feedback</div>
      <h1>Rate your experience</h1>
      <p className="muted">Share what is working well and what should improve next.</p>
      <div className="star-row">{[1,2,3,4,5].map((star)=><button key={star} className={`star-btn ${star <= rating ? "star-active" : ""}`} onClick={()=>setRating(star)} type="button">★</button>)}</div>
      <textarea className="text-area compact-area" placeholder="Write your feedback..." value={message} onChange={(e)=>setMessage(e.target.value)} />
      <button className="primary-btn" onClick={submit} disabled={busy}>{busy ? "Submitting..." : "Submit feedback"}</button>
      {done ? <div className="success-box">{done}</div> : null}
    </div>
  );
}

function Pricing({ user, refreshUser }) {
  const [pricing, setPricing] = useState(null); const [plans, setPlans] = useState([]); const [currentSub, setCurrentSub] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const loadPlans = async () => { const pricingData = await api.pricing(); const planData = await api.subscriptionPlans(); const subData = await api.currentSubscription().catch(()=>({subscription:null})); setPricing(pricingData); setPlans(planData.plans || []); setCurrentSub(subData.subscription || null); };
  useEffect(() => { loadPlans().catch((err)=>setError(err.message)); }, []);
  const upgradeOneTimePro = async () => {
    setBusy(true); setError("");
    try {
      const order = await api.createOrder();
      if (!window.Razorpay) throw new Error("Razorpay script not loaded. Add your frontend key after KYC.");
      const options = { key: import.meta.env.VITE_RAZORPAY_KEY_ID || order.key, amount: order.amount, currency: order.currency, name: order.name, description: order.description, order_id: order.order_id, prefill: order.prefill, theme: { color: "#8b5cf6" }, modal: { ondismiss: () => setBusy(false) }, handler: async function (response) { try { await api.verifyPayment(response); await refreshUser(); alert("Payment successful. Pro activated."); } catch (err) { setError(err.message); } finally { setBusy(false); } } };
      const razorpay = new window.Razorpay(options); razorpay.open();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  const createSubscription = async (planCode) => { try { const data = await api.createSubscription({ plan_code: planCode }); if (data.short_url) window.open(data.short_url, "_blank", "noopener,noreferrer"); else alert("Subscription created: " + data.plan_code); await loadPlans(); } catch (err) { setError(err.message); } };
  const standardPlans = plans.filter((p) => p.feature_level === "standard");
  const proPlans = plans.filter((p) => p.feature_level === "pro");
  return (
    <div className="pricing-stack">
      {currentSub ? <div className="card"><div className="eyebrow">Current subscription</div><h2>{currentSub.plan_code}</h2><div className="muted">Status: {currentSub.status}</div><div className="muted">Started: {currentSub.started_at || "-"}</div><div className="muted">Expires: {currentSub.expires_at || "-"}</div></div> : null}
      <div className="pricing-grid three-tier-grid">
        <div className="price-card card"><div className="eyebrow">Free</div><h2>₹0</h2><p className="muted">4 free resume analyses</p><ul><li>4 total analyses</li><li>ATS score + rewrite suggestions</li><li>History + version comparison</li></ul></div>
        <div className="price-card card"><div className="eyebrow">Standard</div><h2>₹199 / ₹1999</h2><p className="muted">Unlimited resume analysis</p><ul><li>Unlimited ATS scans</li><li>Version comparison</li><li>Cover letter + interview prep</li></ul>{standardPlans.length ? <div className="subscription-list single-col-list">{standardPlans.map((plan)=><div key={plan.code} className="subscription-card"><strong>{plan.name}</strong><div className="muted">₹{plan.price_inr} / {plan.billing_cycle}</div><button className="ghost-btn" onClick={()=>createSubscription(plan.code)}>Choose {plan.name}</button></div>)}</div> : <div className="error-box">Standard plans not loading.</div>}</div>
        <div className="price-card card highlight glow-card"><div className="eyebrow">Pro</div><h2>₹499 / ₹5499</h2><p className="muted">Premium tools + job match + PDF export</p><ul><li>Everything in Standard</li><li>JD tailoring + keyword gap analysis</li><li>PDF export</li><li>Premium upgrade path</li></ul>{proPlans.length ? <div className="subscription-list single-col-list">{proPlans.map((plan)=><div key={plan.code} className="subscription-card"><strong>{plan.name}</strong><div className="muted">₹{plan.price_inr} / {plan.billing_cycle}</div><button className="ghost-btn" onClick={()=>createSubscription(plan.code)}>Choose {plan.name}</button></div>)}</div> : <div className="error-box">Pro plans not loading.</div>}{!user?.is_paid ? <button className="primary-btn" onClick={upgradeOneTimePro} disabled={busy}>{busy ? "Opening checkout..." : `One-time Pro unlock${pricing ? ` · ₹${pricing.one_time_pro_price_inr}` : ""}`}</button> : <div className="success-box">You already have paid access.</div>}</div>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
    </div>
  );
}

function Admin() {
  const [data, setData] = useState(null); const [plans, setPlans] = useState([]); const [feedback, setFeedback] = useState([]); const [analytics, setAnalytics] = useState(null); const [error, setError] = useState("");
  const [form, setForm] = useState({ code: "standard_monthly", name: "Standard Monthly", period: "monthly", interval_count: 1, amount_inr: 199, currency: "INR", description: "Standard monthly subscription plan" });
  const load = async () => {
    try {
      const [overview, planData, feedbackData, analyticsData] = await Promise.all([api.adminOverview(), api.adminListRazorpayPlans(), api.adminFeedback().catch(()=>({items:[]})), api.adminFeedbackAnalytics().catch(()=>null)]);
      setData(overview); setPlans(planData.plans || []); setFeedback(feedbackData.items || []); setAnalytics(analyticsData);
    } catch (err) { setError(err.message); }
  };
  useEffect(()=>{ load(); },[]);
  const createPlan = async (e) => { e.preventDefault(); setError(""); try { await api.adminCreateRazorpayPlan(form); await load(); alert("Razorpay plan created and saved."); } catch (err) { setError(err.message); } };
  const togglePlan = async (plan) => { try { if (plan.active) await api.adminDeactivateRazorpayPlan(plan.id); else await api.adminActivateRazorpayPlan(plan.id); await load(); } catch (err) { setError(err.message); } };
  if (!data) return <div className="card">Loading admin data...</div>;
  return (
    <div className="pricing-stack">
      <div className="pricing-grid admin-stats-grid">
        <div className="card"><div className="eyebrow">Users</div><h2>{data.stats.users}</h2></div>
        <div className="card"><div className="eyebrow">Paid users</div><h2>{data.stats.paid_users}</h2></div>
        <div className="card"><div className="eyebrow">Analyses</div><h2>{data.stats.analyses}</h2></div>
        <div className="card"><div className="eyebrow">Subscriptions</div><h2>{data.stats.subscriptions}</h2></div>
        <div className="card"><div className="eyebrow">Feedback count</div><h2>{analytics?.count ?? data.stats.feedback_count ?? 0}</h2></div>
        <div className="card"><div className="eyebrow">Average rating</div><h2>{analytics?.average_rating ?? 0}</h2></div>
      </div>
      {analytics?.common_topics?.length ? <div className="card"><div className="eyebrow">Common complaints</div><div className="chip-row">{analytics.common_topics.map((x, i)=><span className="tag-chip" key={i}>{x.topic} ({x.count})</span>)}</div></div> : null}
      <div className="card">
        <div className="eyebrow">Create Razorpay plan</div><h2>Build Standard or Pro plans</h2>
        <form className="form-grid admin-plan-form" onSubmit={createPlan}>
          <input placeholder="Code" value={form.code} onChange={(e)=>setForm((p)=>({...p, code:e.target.value}))} />
          <input placeholder="Name" value={form.name} onChange={(e)=>setForm((p)=>({...p, name:e.target.value}))} />
          <select className="file-input" value={form.period} onChange={(e)=>setForm((p)=>({...p, period:e.target.value}))}><option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="yearly">yearly</option></select>
          <input type="number" placeholder="Interval count" value={form.interval_count} onChange={(e)=>setForm((p)=>({...p, interval_count:e.target.value}))} />
          <input type="number" step="0.01" placeholder="Amount INR" value={form.amount_inr} onChange={(e)=>setForm((p)=>({...p, amount_inr:e.target.value}))} />
          <input placeholder="Currency" value={form.currency} onChange={(e)=>setForm((p)=>({...p, currency:e.target.value}))} />
          <input className="admin-plan-description" placeholder="Description" value={form.description} onChange={(e)=>setForm((p)=>({...p, description:e.target.value}))} />
          <button className="primary-btn" type="submit">Create plan</button>
        </form>
        {error ? <div className="error-box">{error}</div> : null}
      </div>
      <div className="card"><div className="eyebrow">Saved Razorpay plans</div><div className="table-wrap"><table className="admin-table"><thead><tr><th>Code</th><th>Name</th><th>Provider Plan ID</th><th>Cycle</th><th>Amount</th><th>Currency</th><th>Active</th><th>Action</th></tr></thead><tbody>{plans.map((p)=><tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td>{p.provider_plan_id}</td><td>{p.interval_count} {p.period}</td><td>₹{(p.amount/100).toFixed(2)}</td><td>{p.currency}</td><td>{p.active ? "Yes" : "No"}</td><td><button className="ghost-btn small-btn" onClick={()=>togglePlan(p)}>{p.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div></div>
      <div className="card"><div className="eyebrow">Latest feedback</div><div className="history-list">{feedback.length ? feedback.map((item)=><div className="history-card" key={item.id}><div className="history-top"><strong>{item.email}</strong><span>{item.created_at}</span></div><div className="history-score">Rating {item.rating}/5</div><p>{item.message || "No written feedback."}</p></div>) : <div className="empty-state"><p>No feedback submitted yet.</p></div>}</div></div>
    </div>
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
  if (user === undefined) return <div className="loader-screen">Loading...</div>;
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
      <Route path="/dsa-arena" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><DsaArenaPage /></Layout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><ProfilePage /></Layout></ProtectedRoute>} />
      <Route path="/pricing" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><Pricing user={user} refreshUser={refreshUser} /></Layout></ProtectedRoute>} />
      <Route path="/feedback" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><FeedbackPage /></Layout></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute user={user}><Layout user={user} setUser={setUser}><Admin /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}