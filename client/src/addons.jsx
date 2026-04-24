import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";

function toneClass(value) {
  if (value === "Strong") return "tone-good";
  if (value === "Average") return "tone-warn";
  return "tone-bad";
}

export function MockInterviewPage() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [result, setResult] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.startMockInterview({
        resume_text: resumeText,
        job_description: jobDescription,
        target_role: targetRole,
      });
      setResult(data.result);
      setQuestionIndex(0);
      setAnswer("");
      setFeedback(null);
      setHistory([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const allQuestions = useMemo(() => {
    if (!result) return [];
    return [
      ...(result.expected_questions || []),
      ...(result.hr_questions || []),
      ...(result.technical_questions || []),
      ...(result.project_questions || []),
      ...(result.jd_questions || []),
    ];
  }, [result]);

  const question = allQuestions[questionIndex] || "";

  const evaluate = async () => {
    if (!question) return;
    setBusy(true);
    setError("");
    try {
      const data = await api.evaluateMockAnswer({ question, answer });
      setFeedback(data.result);
      setHistory((prev) => [
        ...prev,
        {
          question,
          answer,
          rating: data.result?.rating,
          score: data.result?.score,
          follow_up: data.result?.follow_up,
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const nextQuestion = () => {
    setQuestionIndex((prev) => Math.min(prev + 1, allQuestions.length - 1));
    setAnswer("");
    setFeedback(null);
  };

  const previousQuestion = () => {
    setQuestionIndex((prev) => Math.max(prev - 1, 0));
    setAnswer("");
    setFeedback(null);
  };

  const completed = history.length;
  const averageScore = history.length
    ? Math.round(history.reduce((acc, item) => acc + (item.score || 0), 0) / history.length)
    : 0;

  return (
    <div className="pricing-stack">
      <div className="hero card glow-card">
        <div>
          <div className="eyebrow">Mock Interview</div>
          <h1>Expected interviewer questions from your resume</h1>
          <p className="muted">
            Generate interviewer-style questions from your resume, target role, projects, and job description.
            Practice one by one, get ratings, and see follow-up questions the interviewer may ask next.
          </p>
        </div>
        <div className="stats-row">
          <div className="stat-chip"><span>Questions</span><strong>{allQuestions.length}</strong></div>
          <div className="stat-chip"><span>Completed</span><strong>{completed}</strong></div>
          <div className="stat-chip"><span>Avg score</span><strong>{averageScore || "-"}</strong></div>
          <div className="stat-chip"><span>Current step</span><strong>{allQuestions.length ? `${questionIndex + 1}/${allQuestions.length}` : "-"}</strong></div>
          <div className="stat-chip"><span>Interview mode</span><strong>{result ? "Resume-based" : "-"}</strong></div>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Interview setup</div>
        <div className="form-grid">
          <input
            placeholder="Target role (example: Frontend Developer)"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          />
          <textarea
            className="text-area"
            placeholder="Paste resume text"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />
          <textarea
            className="text-area"
            placeholder="Paste job description (optional)"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>
        <div className="action-row">
          <button className="primary-btn" onClick={start} disabled={busy}>
            {busy ? "Building interview..." : "Start mock interview"}
          </button>
          <button
            className="ghost-btn"
            onClick={() => {
              setResumeText("");
              setJobDescription("");
              setTargetRole("");
              setResult(null);
              setQuestionIndex(0);
              setAnswer("");
              setFeedback(null);
              setHistory([]);
            }}
            type="button"
          >
            Reset
          </button>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
      </div>

      {result ? (
        <>
          <div className="card">
            <div className="eyebrow">Focus areas</div>
            <div className="chip-row">
              {(result.focus_areas || []).map((item, idx) => (
                <span className="tag-chip" key={idx}>{item}</span>
              ))}
            </div>
          </div>

          <div className="result-grid">
            <div className="result-block question-bank-card">
              <h3>Expected interviewer questions</h3>
              <ul>{result.expected_questions?.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
            <div className="result-block question-bank-card">
              <h3>Technical depth checks</h3>
              <ul>{result.technical_questions?.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
            <div className="result-block question-bank-card">
              <h3>Project evidence prompts</h3>
              <ul>{result.project_questions?.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
            <div className="result-block question-bank-card">
              <h3>JD evidence questions</h3>
              <ul>{result.jd_questions?.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          </div>

          <div className="comparison-box">
            <div className="eyebrow">Question navigator</div>
            <div className="question-grid">
              {allQuestions.map((q, idx) => (
                <button
                  key={idx}
                  className={`question-chip ${questionIndex === idx ? "question-chip-active" : ""}`}
                  onClick={() => {
                    setQuestionIndex(idx);
                    setAnswer("");
                    setFeedback(null);
                  }}
                  type="button"
                >
                  Q{idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="card inner-card">
            <div className="eyebrow">Answer practice</div>
            <h2>{question || "Choose a question"}</h2>
            <textarea
              className="text-area"
              placeholder="Write your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <div className="action-row">
              <button className="ghost-btn" onClick={previousQuestion} disabled={questionIndex === 0}>Previous</button>
              <button className="primary-btn" onClick={evaluate} disabled={busy || !question}>
                {busy ? "Evaluating..." : "Evaluate answer"}
              </button>
              <button className="ghost-btn" onClick={nextQuestion} disabled={questionIndex >= allQuestions.length - 1}>Next</button>
            </div>

            {feedback ? (
              <div className="pricing-stack" style={{ marginTop: 16 }}>
                <div className={`feedback-banner ${toneClass(feedback.rating)}`}>
                  <div>
                    <div className="small-label">Interview rating</div>
                    <div className="feedback-rating">{feedback.rating}</div>
                  </div>
                  <div className="feedback-score">{feedback.score}/100</div>
                </div>

                <div className="result-grid">
                  <div className="result-block" style={{ gridColumn: "1 / -1" }}>
                    <h3>Feedback</h3>
                    <p>{feedback.feedback}</p>
                  </div>
                  <div className="result-block">
                    <h3>Follow-up interviewer may ask</h3>
                    <p>{feedback.follow_up}</p>
                  </div>
                  <div className="result-block">
                    <h3>Improve next</h3>
                    <ul>{feedback.improvements?.map((item, idx) => <li key={idx}>{item}</li>)}</ul>
                  </div>
                  <div className="result-block">
                    <h3>Quality markers</h3>
                    <ul>{(feedback.quality_markers || []).length ? feedback.quality_markers.map((item, idx) => <li key={idx}>{item}</li>) : <li>No strong interview markers detected yet.</li>}</ul>
                  </div>
                  <div className="result-block" style={{ gridColumn: "1 / -1" }}>
                    <h3>Recommended structure</h3>
                    <ul>{feedback.recommended_structure?.map((item, idx) => <li key={idx}>{item}</li>)}</ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ marginTop: 16 }}>
                <p>Write an answer to get a score, follow-up question, and improvement tips.</p>
              </div>
            )}
          </div>

          <div className="card">
            <div className="eyebrow">Interview progress</div>
            <div className="history-list">
              {history.length ? history.map((item, idx) => (
                <div className="history-card" key={idx}>
                  <div className="history-top">
                    <strong>{item.question}</strong>
                    <span>{item.rating} · {item.score}/100</span>
                  </div>
                  <p className="muted">Follow-up: {item.follow_up}</p>
                </div>
              )) : <div className="empty-state"><p>No evaluated answers yet.</p></div>}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>No mock interview started yet. Paste your resume and generate expected interviewer questions.</p>
        </div>
      )}
    </div>
  );
}

export function DsaArenaPage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ title: "", difficulty: "easy", score: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setData(await api.dsaStatus());
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.submitDsa({ ...form, score: Number(form.score || 0) });
      setForm({ title: "", difficulty: "easy", score: 0 });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="card">Loading DSA status...</div>;

  const solved = data.profile?.total_solved || 0;
  const rating = data.profile?.rating || 0;
  const level = rating >= 1800 ? "Advanced" : rating >= 1400 ? "Intermediate" : "Foundation";

  return (
    <div className="pricing-stack">
      <div className="hero card glow-card">
        <div>
          <div className="eyebrow">DSA Arena</div>
          <h1>Track rank, progress, and competition</h1>
          <p className="muted">
            Log solved problems, build rating, and see exactly where you stand against the leaderboard.
            Use this page as a practice tracker before interviews and placements.
          </p>
        </div>
        <div className="stats-row">
          <div className="stat-chip"><span>Your rank</span><strong>#{data.rank || "-"}</strong></div>
          <div className="stat-chip"><span>Ahead</span><strong>{data.people_ahead ?? 0}</strong></div>
          <div className="stat-chip"><span>Behind</span><strong>{data.people_behind ?? 0}</strong></div>
          <div className="stat-chip"><span>Percentile</span><strong>{data.percentile}%</strong></div>
          <div className="stat-chip"><span>Level</span><strong>{data.band || level}</strong></div>
        </div>
      </div>

      <div className="result-grid">
        <div className="card">
          <div className="eyebrow">Submit a solved problem</div>
          <form className="form-grid" onSubmit={submit}>
            <input
              placeholder="Problem title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
            <select
              className="file-input"
              value={form.difficulty}
              onChange={(e) => setForm((p) => ({ ...p, difficulty: e.target.value }))}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <input
              type="number"
              placeholder="Bonus score (0-20)"
              value={form.score}
              onChange={(e) => setForm((p) => ({ ...p, score: e.target.value }))}
            />
            <button className="primary-btn" type="submit" disabled={busy}>
              {busy ? "Saving..." : "Add solved problem"}
            </button>
          </form>
          {error ? <div className="error-box">{error}</div> : null}
        </div>

        <div className="card">
          <div className="eyebrow">Your status</div>
          <div className="chip-row">
            <span className="tag-chip">Easy: {data.profile.easy_solved}</span>
            <span className="tag-chip">Medium: {data.profile.medium_solved}</span>
            <span className="tag-chip">Hard: {data.profile.hard_solved}</span>
            <span className="tag-chip">Streak: {data.profile.streak_days} days</span>
            <span className="tag-chip">Solved: {solved}</span>
            <span className="tag-chip">Rating: {rating}</span>
          </div>
          <div className="summary-pills">
            <div className="summary-pill">You are ahead of <strong>{data.people_behind}</strong> users</div>
            <div className="summary-pill">You are behind <strong>{data.people_ahead}</strong> users</div>
            <div className="summary-pill">Current percentile <strong>{data.percentile}%</strong></div>
          </div>
        </div>
      </div>

      <div className="result-grid">
        <div className="card">
          <div className="eyebrow">Leaderboard</div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Rank</th><th>Name</th><th>Solved</th><th>Rating</th></tr>
              </thead>
              <tbody>
                {(data.leaderboard || []).map((item, idx) => (
                  <tr key={idx} className={item.name === "You" ? "leader-you" : ""}>
                    <td>#{idx + 1}</td>
                    <td>{item.name}</td>
                    <td>{item.solved}</td>
                    <td>{item.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">Recent submissions</div>
          <div className="history-list">
            {data.recent_submissions?.length ? data.recent_submissions.map((item, idx) => (
              <div className="history-card" key={idx}>
                <div className="history-top">
                  <strong>{item.title}</strong>
                  <span>{item.created_at}</span>
                </div>
                <div className="history-score">{item.difficulty} · score {item.score}</div>
              </div>
            )) : <div className="empty-state"><p>No submissions yet.</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
