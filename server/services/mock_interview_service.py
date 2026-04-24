
import re
from collections import Counter

QUESTION_TEMPLATES = {
    'summary': 'Can you summarize your background and explain why it fits this role?',
    'impact': 'Tell me about a project where you created measurable impact. What was the outcome?',
    'challenge': 'Describe a technical challenge you faced in one of your projects and how you solved it.',
    'choice': 'What trade-offs did you make in your strongest project and why?',
    'behavioral': 'Tell me about a time you handled pressure, ambiguity, or a tight deadline.',
}

def _sentences(text: str):
    parts = [p.strip() for p in re.split(r'[\n\.!?]+', text) if p.strip()]
    return [p for p in parts if len(p.split()) >= 5]

def _keywords(text: str, limit: int = 12):
    words = re.findall(r'[A-Za-z][A-Za-z0-9+#/.]{2,}', text.lower())
    ignore = {'with','from','have','that','this','your','using','used','experience','project','skills','role','team','work','about','resume','built'}
    ranked = [w for w,_ in Counter(w for w in words if w not in ignore).most_common(limit)]
    return ranked

def build_resume_based_mock_interview(resume_text: str, job_description: str = '', target_role: str = ''):
    resume_lines = _sentences(resume_text)
    jd_keys = _keywords(job_description, 10)
    resume_keys = _keywords(resume_text, 12)
    role = target_role or (_keywords(job_description, 1)[0].title() if job_description else 'this role')
    projects = [s for s in resume_lines if any(k in s.lower() for k in ['project', 'built', 'developed', 'implemented', 'designed', 'created'])][:6]

    expected = [
        f'Walk me through your resume and explain why you are a fit for {role}.',
        'Which part of your background is most relevant to this role and why?',
        QUESTION_TEMPLATES['impact'],
        QUESTION_TEMPLATES['challenge'],
        'What is the strongest proof on your resume that you can deliver value quickly?',
        f'Which experience on your resume best demonstrates readiness for {role}?',
    ]

    technical = []
    for kw in (jd_keys[:5] or resume_keys[:5]):
        technical.extend([
            f'How have you used {kw} in a real project, and what problem did it solve?',
            f'What trade-off or challenge did you face while working with {kw}?',
        ])
    technical = technical[:8]

    hr = [
        'Tell me about yourself.',
        f'Why are you interested in {role}?',
        'What are your strengths and what area are you improving right now?',
        'Describe a time you worked in a team and handled a disagreement.',
        QUESTION_TEMPLATES['behavioral'],
    ]

    project_based = []
    for p in projects[:4]:
        project_based.extend([
            f'You wrote: "{p}". Explain this project end to end.',
            f'For this item: "{p}", what exactly did you own and what result came from it?',
            f'If an interviewer asks about this line — "{p}" — how would you justify its business or technical impact?',
        ])

    jd_questions = []
    for kw in jd_keys[:6]:
        jd_questions.append(f'The job emphasizes "{kw}". Where is the strongest evidence for that on your resume?')
    if not jd_questions:
        jd_questions = [
            'What on your resume best proves you match the target job description?',
            'Which bullet on your resume should an interviewer care about most for this role?',
        ]

    return {
        'expected_questions': expected,
        'technical_questions': technical,
        'hr_questions': hr,
        'project_questions': project_based,
        'jd_questions': jd_questions,
        'focus_areas': jd_keys[:6] or resume_keys[:6],
    }




def evaluate_mock_answer(question: str, answer: str):
    answer = (answer or '').strip()
    lowered = answer.lower()
    q = (question or '').lower()
    length = len(answer.split())
    has_metrics = any(ch.isdigit() for ch in answer)
    has_tech = any(k in lowered for k in ['react', 'python', 'sql', 'flask', 'api', 'docker', 'aws', 'java', 'cpp', 'javascript', 'node', 'mongodb', 'postgresql'])
    has_structure = any(w in lowered for w in ['because', 'so that', 'therefore', 'challenge', 'result', 'impact', 'improved', 'reduced', 'increased'])
    has_ownership = any(w in lowered for w in ['i built', 'i implemented', 'i designed', 'i created', 'i optimized', 'my role', 'i was responsible'])
    has_outcome = any(w in lowered for w in ['outcome', 'result', 'impact', 'improved', 'reduced', 'increased', '%'])
    has_reflection = any(w in lowered for w in ['learned', 'would improve', 'next time', 'trade-off', 'constraint'])
    score = 22
    if length >= 20: score += 12
    if length >= 45: score += 14
    if length >= 80: score += 10
    if has_metrics: score += 10
    if has_tech: score += 10
    if has_structure: score += 10
    if has_ownership: score += 10
    if has_outcome: score += 9
    if has_reflection: score += 6
    if any(x in q for x in ['project', 'built', 'developed', 'implemented']) and has_tech:
        score += 4
    if any(x in q for x in ['challenge', 'trade-off', 'constraint']) and has_reflection:
        score += 5
    score = max(18, min(97, score))
    improvement_tips = []
    if not has_metrics:
        improvement_tips.append('Add numbers, metrics, or measurable impact.')
    if not has_ownership:
        improvement_tips.append('Clarify exactly what you owned and delivered.')
    if not has_tech and any(x in q for x in ['project', 'technical']):
        improvement_tips.append('Mention tools, technologies, or approaches you used.')
    if length < 45:
        improvement_tips.append('Give more context, action, and final outcome.')
    if not has_outcome:
        improvement_tips.append('End with a clear result, business or technical impact.')
    if score >= 82:
        rating = 'Strong'
        feedback = 'Strong answer. You sound credible, specific, and interviewer-ready.'
        follow_up = 'What trade-off, constraint, or decision most influenced the final result?'
    elif score >= 60:
        rating = 'Average'
        feedback = 'Average answer. The direction is fine, but it still needs sharper ownership, stronger proof, and clearer impact.'
        follow_up = 'Can you re-answer this using problem → action → impact, with one concrete metric?'
    else:
        rating = 'Weak'
        feedback = 'Weak answer. It sounds too generic and needs a specific example, deeper ownership, and stronger evidence.'
        follow_up = 'Pick one real example and walk through the problem, your action, and the measurable outcome.'
    markers = []
    if has_ownership: markers.append('Ownership present')
    if has_metrics: markers.append('Metrics present')
    if has_outcome: markers.append('Outcome present')
    if has_tech: markers.append('Technical depth present')
    return {
        'score': score,
        'rating': rating,
        'feedback': feedback,
        'follow_up': follow_up,
        'improvements': improvement_tips[:5],
        'quality_markers': markers,
        'recommended_structure': ['Situation / Context', 'Your action', 'Tools / approach', 'Measured impact', 'Reflection / learning'],
    }
