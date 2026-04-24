import json
import re
from collections import Counter
from flask import current_app

try:
    from anthropic import Anthropic
except Exception:
    Anthropic = None


STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "you", "your", "are", "was", "were",
    "from", "have", "has", "will", "can", "our", "their", "about", "into", "using",
    "role", "work", "team", "job", "description", "required", "skills"
}


def _tokens(text: str):
    return re.findall(r"[a-zA-Z0-9+#/.]+", (text or "").lower())


def _extract_keywords(text: str, limit: int = 15):
    counts = Counter([t for t in _tokens(text) if len(t) > 2 and t not in STOPWORDS])
    return [word for word, _ in counts.most_common(limit)]


def _sections_present(text: str):
    lower = (text or "").lower()
    return {
        "summary": any(k in lower for k in ["summary", "profile", "objective"]),
        "experience": any(k in lower for k in ["experience", "internship", "work history"]),
        "skills": "skills" in lower or "technical skills" in lower,
        "projects": "project" in lower or "projects" in lower,
        "education": "education" in lower,
    }


def _fallback_analysis(text: str, job_description: str | None = None):
    lower = (text or "").lower()
    sections = _sections_present(text)

    tech_hits = sum(k in lower for k in [
        "python", "java", "javascript", "react", "node", "flask", "api", "sql",
        "mongodb", "postgresql", "docker", "git", "machine learning", "html", "css"
    ])

    score = 52 + min(26, tech_hits * 3)
    score += 5 if sections["summary"] else 0
    score += 6 if sections["experience"] else 0
    score += 5 if sections["skills"] else 0
    score += 6 if sections["projects"] else 0
    score = min(score, 94)

    jd_keys = _extract_keywords(job_description or text, 14)
    resume_tokens = set(_tokens(text))
    missing = [k for k in jd_keys if k not in resume_tokens][:8] or [
        "quantified impact", "role-specific keywords", "measurable achievements"
    ]

    matched = [k for k in jd_keys if k in resume_tokens][:8]
    semantic_alignment = None
    if job_description:
        semantic_alignment = min(95, max(38, 45 + len(matched) * 5 - len(missing[:5]) * 2))

    weak_sections = []
    if not sections["summary"]:
        weak_sections.append("Summary/Profile section is missing or weak.")
    if not sections["experience"]:
        weak_sections.append("Experience section needs clearer responsibilities and measurable impact.")
    if not sections["skills"]:
        weak_sections.append("Skills section should be aligned with the target job keywords.")
    if not sections["projects"]:
        weak_sections.append("Projects section should show tech stack, problem solved, and outcome.")
    if not weak_sections:
        weak_sections.append("Structure is good; improve impact metrics and role-specific wording.")

    return {
        "ats_score": score,
        "semantic_alignment": semantic_alignment,
        "summary": "Resume has a strong base, but it should be more targeted with measurable achievements and role-specific keywords.",
        "strengths": [
            "Readable resume structure",
            "Relevant technical/profile keywords detected",
            "Good foundation for ATS optimization"
        ],
        "missing_skills": missing,
        "weak_sections": weak_sections,
        "suggestions": [
            "Add measurable outcomes such as percentage improvement, users impacted, or time saved.",
            "Mirror the job description keywords naturally inside skills and experience.",
            "Rewrite summary to target the exact role and domain.",
            "Use action verbs like Built, Designed, Improved, Automated, Optimized.",
            "Add project outcomes, not just project names.",
        ],
        "rewrite_examples": [
            {
                "before": "Worked on a web application.",
                "after": "Built a responsive web application using React and Flask, improving user workflow speed and maintainability."
            },
            {
                "before": "Made a machine learning project.",
                "after": "Developed an ML-based analysis system with preprocessing, model evaluation, and actionable insights."
            }
        ]
    }


def _try_anthropic_json(prompt: str):
    api_key = current_app.config.get("ANTHROPIC_API_KEY", "")
    if not api_key or Anthropic is None:
        return None

    client = Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text if msg.content else ""

    try:
        return json.loads(text)
    except Exception:
        return None


def analyze_resume_text(resume_text: str, job_description: str | None = None):
    prompt = f"""
Return only valid JSON for resume ATS analysis with keys:
ats_score, semantic_alignment, summary, strengths, missing_skills, weak_sections, suggestions, rewrite_examples.

Resume:
{resume_text[:7000]}

Job description:
{(job_description or '')[:4000]}
"""
    ai_result = _try_anthropic_json(prompt)
    if ai_result:
        return ai_result
    return _fallback_analysis(resume_text, job_description)


def build_rewrite_suggestions(resume_text: str, job_description: str = ""):
    analysis = analyze_resume_text(resume_text, job_description)
    missing = analysis.get("missing_skills", [])[:8]
    weak = analysis.get("weak_sections", [])[:4]

    top_keywords = ", ".join(missing[:5]) if missing else "role-specific keywords"

    return {
        "summary": (
            "Results-driven candidate with hands-on experience in relevant technologies, "
            f"focused on {top_keywords}, problem solving, and measurable project impact."
        ),
        "skills_to_add": missing,
        "weak_sections": weak,
        "experience_rewrites": analysis.get("rewrite_examples", [
            {
                "before": "Worked on a project.",
                "after": "Built a practical project using modern tools, improving usability and demonstrating end-to-end ownership."
            }
        ]),
        "project_rewrite": (
            "Rewrite projects using this format: Problem solved + tech stack + your contribution + measurable result."
        ),
        "action_plan": [
            "Improve the top summary for the exact target role.",
            "Add 4–6 measurable bullets in experience/projects.",
            "Add missing JD keywords naturally in skills and project descriptions.",
            "Remove vague lines and replace them with outcome-focused bullets.",
        ],
    }