
import re
from collections import Counter
from services.ai_service import analyze_resume_text, build_rewrite_suggestions

STOPWORDS = {
    'and','the','for','with','your','you','from','that','this','are','our','have','will','has','into','using','use','job','role','team','years','year','work','working','within','their','they','them','about','than','all','any','can','able','who','what','when','where','why','how','must','should','including','such'
}
PRIORITY_TERMS = {
    'python','sql','react','flask','docker','aws','kubernetes','api','javascript','typescript','node','postgresql','mongodb','redis','git','machine','learning','nlp','analytics','excel','powerbi','tableau','llm','rag','airflow'
}

def _tokens(text: str):
    parts = re.findall(r"[A-Za-z0-9+#./-]{2,}", text.lower())
    return [p for p in parts if p not in STOPWORDS]

def _top_keywords(text: str, limit: int = 30):
    counts = Counter(_tokens(text))
    weighted = []
    for token, count in counts.items():
        if token.isdigit():
            continue
        weight = count + (3 if token in PRIORITY_TERMS else 0)
        weighted.append((token, weight))
    weighted.sort(key=lambda x: (-x[1], x[0]))
    return [t for t, _ in weighted[:limit]]

def semantic_job_match(resume_text: str, job_description: str):
    jd_keywords = _top_keywords(job_description, 35)
    resume_tokens = set(_tokens(resume_text))
    matched = [kw for kw in jd_keywords if kw in resume_tokens]
    missing = [kw for kw in jd_keywords if kw not in resume_tokens]
    ai = analyze_resume_text(resume_text, job_description)
    rewrites = build_rewrite_suggestions(resume_text, job_description)
    score = ai.get('semantic_alignment') or ai.get('ats_score') or 0

    weak_sections = []
    lower = resume_text.lower()
    if 'summary' not in lower and 'profile' not in lower:
        weak_sections.append('summary')
    if 'experience' not in lower:
        weak_sections.append('experience')
    if 'skills' not in lower:
        weak_sections.append('skills')

    bullets_to_rewrite = [
        {
            'before': 'Worked on frontend features for the application.',
            'after': 'Built responsive React features for the application, improving load speed and user experience.'
        },
        {
            'before': 'Handled APIs and backend integration.',
            'after': 'Integrated REST APIs and backend workflows, reducing manual data handling and improving reliability.'
        },
        {
            'before': 'Created project modules.',
            'after': 'Designed and shipped role-aligned project modules with clearer business impact and stronger technical ownership.'
        },
    ]

    return {
        'match_score': score,
        'semantic_alignment': score,
        'matched_keywords': matched[:20],
        'missing_keywords': missing[:15],
        'strength_areas': ai.get('strengths', [])[:5],
        'summary': ai.get('summary', ''),
        'suggestions': ai.get('suggestions', [])[:6],
        'rewrite_suggestions': rewrites.get('rewrite_suggestions', []),
        'section_fixes': rewrites.get('section_fixes', {}),
        'bullets_to_rewrite': bullets_to_rewrite,
        'weak_sections': weak_sections,
        'role_fit': 'Strong fit' if score >= 80 else 'Moderate fit' if score >= 60 else 'Low fit',
    }
