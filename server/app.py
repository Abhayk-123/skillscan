import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from functools import wraps

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask import Flask, request, send_file
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import generate_password_hash, check_password_hash

from config import Config
from db import get_db, close_db
from auth import User, load_user_by_id
from services.resume_parser import parse_resume
from services.ai_service import analyze_resume_text, build_rewrite_suggestions
from services.job_match_service import semantic_job_match
from services.payment_service import create_order, create_plan, create_subscription, verify_signature, verify_webhook_signature
from services.email_service import send_email
from services.pdf_service import build_analysis_pdf
from services.mock_interview_service import build_resume_based_mock_interview, evaluate_mock_answer
from services.dsa_service import DEFAULT_LEADERBOARD, calc_user_rank, competitive_band

PRO_PRICE_PAISE = 9900
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

app = Flask(__name__)
app.config.from_object(Config)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
CORS(
    app,
    supports_credentials=True,
    resources={r"/api/*": {"origins": [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]}},
    origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    storage_uri=app.config['RATELIMIT_STORAGE_URI'],
    default_limits=['200 per day', '50 per hour'],
)

login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return load_user_by_id(int(user_id))

app.teardown_appcontext(close_db)


def utcnow():
    return datetime.now(timezone.utc)


def parse_dt(value):
    if not value:
        return None
    text = str(value).replace('Z', '+00:00')
    try:
        dt = datetime.fromisoformat(text)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        try:
            return datetime.strptime(text[:19], '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
        except Exception:
            return None


def to_db_ts(dt):
    return dt.astimezone(timezone.utc).isoformat() if dt else None


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated:
            return {'error': 'Authentication required.'}, 401
        if getattr(current_user, 'role', 'user') != 'admin':
            return {'error': 'Admin access required.'}, 403
        return fn(*args, **kwargs)
    return wrapper


def get_serializer():
    return URLSafeTimedSerializer(app.config['SECRET_KEY'])


def get_current_user_row(user_id: int):
    db = get_db()
    return db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()


def _get_active_subscription(user_id: int):
    db = get_db()
    return db.execute(
        'SELECT id, provider_subscription_id, plan_code, status, started_at, expires_at, short_url, grace_until, billing_retry_count, last_payment_failed_at FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        (user_id,),
    ).fetchone()


def refresh_user_subscription_state(user_id: int):
    db = get_db()
    sub = _get_active_subscription(user_id)
    if not sub:
        return
    now = utcnow()
    status = str(sub['status'])
    grace_until = parse_dt(sub.get('grace_until'))
    expires_at = parse_dt(sub.get('expires_at'))
    should_free = False
    if status in {'cancelled', 'completed', 'halted'}:
        if not grace_until or now >= grace_until:
            should_free = True
    elif expires_at and now > expires_at and (not grace_until or now >= grace_until):
        should_free = True
    if should_free:
        db.execute("UPDATE users SET is_paid = 0, plan = 'free' WHERE id = ?", (user_id,))
        db.commit()


def get_feature_access_for_plan(plan: str, is_paid: bool):
    feature_map = {
        'free': {'resume_analysis': True, 'history': True, 'job_match': False, 'pdf_export': False},
        'standard': {'resume_analysis': True, 'history': True, 'job_match': False, 'pdf_export': False},
        'pro': {'resume_analysis': True, 'history': True, 'job_match': True, 'pdf_export': True},
    }
    normalized = plan if plan in feature_map else ('pro' if is_paid else 'free')
    return feature_map[normalized]


def require_feature(feature_name: str):
    if not current_user.is_authenticated:
        return {'error': 'Authentication required.'}, 401
    refresh_user_subscription_state(current_user.id)
    row = get_current_user_row(current_user.id)
    features = get_feature_access_for_plan(row['plan'], bool(row['is_paid']))
    if not features.get(feature_name):
        return {'error': 'This feature requires Pro plan.', 'code': 'FEATURE_REQUIRES_PRO'}, 403
    return None


def user_payload(user):
    refresh_user_subscription_state(user.id)
    row = get_current_user_row(user.id)
    return {
        'id': row['id'],
        'username': row['username'],
        'email': row['email'],
        'plan': row['plan'],
        'free_analyses_used': row['free_analyses_used'],
        'free_analyses_left': max(0, 4 - row['free_analyses_used']),
        'is_paid': bool(row['is_paid']),
        'email_verified': bool(row['email_verified']),
        'role': row['role'],
        'features': get_feature_access_for_plan(row['plan'], bool(row['is_paid'])),
        'subscription': dict(_get_active_subscription(user.id)) if _get_active_subscription(user.id) else None,
    }


def _validate_password(password: str):
    return len(password) >= 8


def _record_webhook_event(provider: str, event_id: str | None, event_type: str, raw_body: bytes):
    db = get_db()
    payload_hash = hashlib.sha256(raw_body).hexdigest()
    existing = db.execute(
        'SELECT id FROM webhook_events WHERE provider = ? AND (event_id = ? OR payload_hash = ?) LIMIT 1',
        (provider, event_id, payload_hash),
    ).fetchone()
    if existing:
        return False
    db.execute(
        'INSERT INTO webhook_events (provider, event_id, event_type, payload_hash, processed) VALUES (?, ?, ?, ?, 1)',
        (provider, event_id, event_type, payload_hash),
    )
    db.commit()
    return True


def ensure_dsa_profile(user_id: int):
    db = get_db()
    row = db.execute('SELECT * FROM dsa_profiles WHERE user_id = ?', (user_id,)).fetchone()
    if row:
        return row
    db.execute('INSERT INTO dsa_profiles (user_id) VALUES (?)', (user_id,))
    db.commit()
    return db.execute('SELECT * FROM dsa_profiles WHERE user_id = ?', (user_id,)).fetchone()

@app.get('/api/health')
@limiter.exempt
def health():
    return {'ok': True}

@app.get('/')
@limiter.exempt
def root():
    return {'message': 'SkillScan backend is running'}


@app.post('/api/auth/signup')
@limiter.limit('5 per hour')
def signup():
    data = request.get_json(force=True)
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not username or not email or not password:
        return {'error': 'Username, email, and password are required.'}, 400
    if not EMAIL_RE.match(email):
        return {'error': 'Enter a valid email address.'}, 400
    if not _validate_password(password):
        return {'error': 'Password must be at least 8 characters.'}, 400
    db = get_db()
    exists = db.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email)).fetchone()
    if exists:
        return {'error': 'User already exists.'}, 409
    db.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', (username, email, generate_password_hash(password)))
    db.commit()
    row = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    user = User(row)
    token = get_serializer().dumps({'user_id': user.id, 'type': 'verify_email'})
    db.execute('INSERT INTO email_verifications (user_id, token) VALUES (?, ?)', (user.id, token))
    db.commit()
    verify_link = f"{app.config['APP_BASE_URL']}/api/auth/verify-email?token={token}"
    send_email(user.email, 'Verify your SkillScan account', f'Click to verify your email: {verify_link}', f'<p>Verify your email: <a href="{verify_link}">{verify_link}</a></p>')
    login_user(user)
    return {'user': user_payload(user), 'message': 'Signup successful. Verification link generated.'}, 201

@app.get('/api/auth/verify-email')
@limiter.exempt
def verify_email():
    token = request.args.get('token', '')
    if not token:
        return {'error': 'Token missing.'}, 400
    try:
        payload = get_serializer().loads(token, max_age=60 * 60 * 24)
    except SignatureExpired:
        return {'error': 'Verification link expired.'}, 400
    except BadSignature:
        return {'error': 'Invalid verification token.'}, 400
    db = get_db()
    row = db.execute('SELECT * FROM email_verifications WHERE token = ? AND used = 0', (token,)).fetchone()
    if not row:
        return {'error': 'Verification token already used or not found.'}, 404
    db.execute('UPDATE email_verifications SET used = 1 WHERE id = ?', (row['id'],))
    db.execute('UPDATE users SET email_verified = 1 WHERE id = ?', (payload['user_id'],))
    db.commit()
    return {'ok': True, 'message': 'Email verified successfully.'}

@app.post('/api/auth/request-password-reset')
@limiter.limit('5 per hour')
def request_password_reset():
    data = request.get_json(force=True)
    email = (data.get('email') or '').strip().lower()
    if not email:
        return {'error': 'Email is required.'}, 400
    db = get_db()
    row = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    if row:
        token = get_serializer().dumps({'user_id': row['id'], 'type': 'reset_password'})
        db.execute('INSERT INTO password_resets (user_id, token) VALUES (?, ?)', (row['id'], token))
        db.commit()
        reset_link = f"{app.config['CLIENT_ORIGIN']}/reset-password?token={token}"
        send_email(email, 'Reset your SkillScan password', f'Click to reset your password: {reset_link}', f'<p>Reset password: <a href="{reset_link}">{reset_link}</a></p>')
    return {'ok': True, 'message': 'If the email exists, a reset link has been generated.'}

@app.post('/api/auth/reset-password')
@limiter.limit('10 per hour')
def reset_password():
    data = request.get_json(force=True)
    token = data.get('token', '')
    new_password = data.get('password', '')
    if not token or not new_password:
        return {'error': 'Token and new password are required.'}, 400
    if not _validate_password(new_password):
        return {'error': 'Password must be at least 8 characters.'}, 400
    try:
        payload = get_serializer().loads(token, max_age=60 * 30)
    except SignatureExpired:
        return {'error': 'Reset link expired.'}, 400
    except BadSignature:
        return {'error': 'Invalid reset token.'}, 400
    db = get_db()
    row = db.execute('SELECT * FROM password_resets WHERE token = ? AND used = 0', (token,)).fetchone()
    if not row:
        return {'error': 'Reset token already used or not found.'}, 404
    db.execute('UPDATE password_resets SET used = 1 WHERE id = ?', (row['id'],))
    db.execute('UPDATE users SET password_hash = ? WHERE id = ?', (generate_password_hash(new_password), payload['user_id']))
    db.commit()
    return {'ok': True, 'message': 'Password reset successful.'}

@app.post('/api/auth/login')
@limiter.limit('10 per hour')
def login():
    data = request.get_json(force=True)
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    db = get_db()
    row = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    if not row or not check_password_hash(row['password_hash'], password):
        return {'error': 'Invalid email or password.'}, 401
    user = User(row)
    login_user(user)
    return {'user': user_payload(user)}

@app.post('/api/auth/logout')
@login_required
def logout():
    logout_user()
    return {'ok': True}

@app.get('/api/auth/me')
def me():
    if not current_user.is_authenticated:
        return {'user': None}
    return {'user': user_payload(current_user)}

@app.get('/api/feature-access')
@login_required
def feature_access():
    row = get_current_user_row(current_user.id)
    return {'features': get_feature_access_for_plan(row['plan'], bool(row['is_paid'])), 'plan': row['plan']}

@app.get('/api/pricing')
def pricing():
    return {
        'free_total_resumes': 4,
        'one_time_pro_price_paise': PRO_PRICE_PAISE,
        'one_time_pro_price_inr': PRO_PRICE_PAISE / 100,
        'tiers': [
            {'code': 'free', 'name': 'Free', 'price_inr': 0, 'billing_cycle': 'lifetime', 'feature_level': 'free'},
            {'code': 'standard_monthly', 'name': 'Standard Monthly', 'price_inr': 199, 'billing_cycle': 'month', 'feature_level': 'standard'},
            {'code': 'standard_yearly', 'name': 'Standard Yearly', 'price_inr': 1999, 'billing_cycle': 'year', 'feature_level': 'standard'},
            {'code': 'pro_monthly', 'name': 'Pro Monthly', 'price_inr': 499, 'billing_cycle': 'month', 'feature_level': 'pro'},
            {'code': 'pro_yearly', 'name': 'Pro Yearly', 'price_inr': 5499, 'billing_cycle': 'year', 'feature_level': 'pro'},
        ],
    }

@app.post('/api/analyze')
@login_required
def analyze():
    if 'resume' not in request.files:
        return {'error': 'Resume file is required.'}, 400
    row = get_current_user_row(current_user.id)
    if not row['is_paid'] and row['free_analyses_used'] >= 4:
        return {'error': 'Free limit reached. Upgrade to Standard or Pro to continue.', 'code': 'FREE_LIMIT_REACHED'}, 402
    file = request.files['resume']
    if not (file.filename or '').lower().endswith(('.pdf', '.docx')):
        return {'error': 'Only PDF and DOCX files are supported.'}, 400
    try:
        resume_text = parse_resume(file)
    except ValueError as e:
        return {'error': str(e)}, 400
    if not resume_text.strip():
        return {'error': 'Could not extract text from the uploaded file.'}, 400
    db = get_db()
    result = analyze_resume_text(resume_text)
    db.execute('INSERT INTO analyses (user_id, file_name, resume_text, result_json) VALUES (?, ?, ?, ?)', (current_user.id, file.filename, resume_text[:12000], json.dumps(result)))
    if not row['is_paid']:
        db.execute('UPDATE users SET free_analyses_used = free_analyses_used + 1 WHERE id = ?', (current_user.id,))
    db.commit()
    return {'result': result, 'user': user_payload(User(get_current_user_row(current_user.id)))}

@app.post('/api/match-job')
@login_required
def match_job():
    blocked = require_feature('job_match')
    if blocked:
        return blocked
    data = request.get_json(force=True)
    resume_text = (data.get('resume_text') or '').strip()
    job_description = (data.get('job_description') or '').strip()
    if not resume_text or not job_description:
        return {'error': 'Resume text and job description are required.'}, 400
    return {'result': semantic_job_match(resume_text, job_description)}

@app.get('/api/history')
@login_required
def history():
    db = get_db()
    rows = db.execute('SELECT id, file_name, resume_text, result_json, created_at FROM analyses WHERE user_id = ? ORDER BY id DESC', (current_user.id,)).fetchall()
    return {'items': [{'id': row['id'], 'file_name': row['file_name'], 'resume_text': row['resume_text'], 'result': json.loads(row['result_json']), 'created_at': str(row['created_at'])} for row in rows]}

@app.get('/api/export-analysis/<int:analysis_id>')
@login_required
def export_analysis(analysis_id):
    blocked = require_feature('pdf_export')
    if blocked:
        return blocked
    db = get_db()
    row = db.execute('SELECT file_name, result_json FROM analyses WHERE id = ? AND user_id = ?', (analysis_id, current_user.id)).fetchone()
    if not row:
        return {'error': 'Analysis not found.'}, 404
    pdf_buffer = build_analysis_pdf(row['file_name'], json.loads(row['result_json']))
    return send_file(pdf_buffer, mimetype='application/pdf', as_attachment=True, download_name='skillscan_report.pdf')

@app.post('/api/payments/create-order')
@login_required
def payments_create_order():
    row = get_current_user_row(current_user.id)
    if row['is_paid']:
        return {'error': 'User already has paid access.'}, 400
    try:
        order = create_order(PRO_PRICE_PAISE, receipt=f'user_{current_user.id}_pro')
    except RuntimeError as e:
        return {'error': str(e)}, 503
    db = get_db()
    db.execute('INSERT INTO payments (user_id, razorpay_order_id, amount, currency, status, payment_type) VALUES (?, ?, ?, ?, ?, ?)', (current_user.id, order['id'], PRO_PRICE_PAISE, 'INR', 'created', 'one_time'))
    db.commit()
    return {'mode': 'one_time', 'order_id': order['id'], 'amount': PRO_PRICE_PAISE, 'currency': 'INR', 'key': app.config['RAZORPAY_KEY_ID'], 'name': 'SkillScan Pro', 'description': 'One-time Pro unlock', 'prefill': {'name': row['username'], 'email': row['email']}}

@app.get('/api/subscriptions/plans')
@login_required
def subscription_plans():
    db = get_db()
    rows = db.execute(
        'SELECT id, code, name, period, interval_count, amount, currency, provider_plan_id, active '
        'FROM razorpay_plans WHERE active = 1 ORDER BY id DESC'
    ).fetchall()

    plans = []
    for row in rows:
        code = row['code']
        feature_level = 'standard' if code.startswith('standard_') else 'pro' if code.startswith('pro_') else 'free'
        display_cycle = row['period'] if row['interval_count'] == 1 else f"{row['interval_count']} {row['period']}"
        plans.append({
            'id': row['id'],
            'code': code,
            'name': row['name'],
            'price_inr': row['amount'] / 100,
            'billing_cycle': display_cycle,
            'plan_id': row['provider_plan_id'],
            'status': 'ready',
            'feature_level': feature_level,
        })
    return {'plans': plans}

@app.get('/api/subscriptions/current')
@login_required
def subscription_current():
    refresh_user_subscription_state(current_user.id)
    row = _get_active_subscription(current_user.id)
    return {'subscription': dict(row) if row else None}

@app.post('/api/subscriptions/cancel')
@login_required
def subscription_cancel():
    db = get_db()
    row = _get_active_subscription(current_user.id)
    if not row:
        return {'error': 'No subscription found.'}, 404
    db.execute("UPDATE subscriptions SET status = 'cancel_requested', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (row['id'],))
    db.commit()
    return {'ok': True, 'message': 'Subscription cancel request saved.', 'subscription_id': row['provider_subscription_id']}

@app.post('/api/subscriptions/create')
@login_required
def subscription_create():
    data = request.get_json(force=True)
    plan_code = data.get('plan_code', 'standard_monthly')
    db = get_db()
    plan_row = db.execute('SELECT provider_plan_id FROM razorpay_plans WHERE code = ? AND active = 1 LIMIT 1', (plan_code,)).fetchone()
    if not plan_row:
        return {'error': 'Plan not configured. Create it from admin first.'}, 400
    try:
        subscription = create_subscription(plan_id=plan_row['provider_plan_id'])
    except RuntimeError as e:
        return {'error': str(e)}, 503
    db.execute('INSERT INTO subscriptions (user_id, provider, provider_subscription_id, status, plan_code, short_url) VALUES (?, ?, ?, ?, ?, ?)', (current_user.id, 'razorpay', subscription['id'], subscription.get('status', 'created'), plan_code, subscription.get('short_url')))
    db.commit()
    return {'ok': True, 'subscription_id': subscription['id'], 'status': subscription.get('status', 'created'), 'plan_code': plan_code, 'short_url': subscription.get('short_url')}

@app.get('/api/admin/razorpay-plans')
@login_required
@admin_required
def admin_list_razorpay_plans():
    db = get_db()
    rows = db.execute('SELECT id, code, name, provider_plan_id, period, interval_count, amount, currency, description, active, source, created_at FROM razorpay_plans ORDER BY id DESC').fetchall()
    return {'plans': [dict(r) for r in rows]}

@app.post('/api/admin/razorpay-plans')
@login_required
@admin_required
def admin_create_razorpay_plan():
    data = request.get_json(force=True)
    code = (data.get('code') or '').strip(); name = (data.get('name') or '').strip(); period = (data.get('period') or '').strip(); description = (data.get('description') or '').strip(); currency = (data.get('currency') or 'INR').strip().upper(); interval_count = int(data.get('interval_count') or 1); amount_inr = float(data.get('amount_inr') or 0)
    if not code or not name or period not in {'daily', 'weekly', 'monthly', 'yearly'} or amount_inr <= 0:
        return {'error': 'code, name, valid period, and amount_inr are required.'}, 400
    try:
        created = create_plan(period=period, interval_count=interval_count, amount_paise=int(round(amount_inr * 100)), name=name, description=description, currency=currency)
    except RuntimeError as e:
        return {'error': str(e)}, 503
    db = get_db()
    existing = db.execute('SELECT id FROM razorpay_plans WHERE code = ?', (code,)).fetchone()
    if existing:
        db.execute('UPDATE razorpay_plans SET name = ?, provider_plan_id = ?, period = ?, interval_count = ?, amount = ?, currency = ?, description = ?, active = 1, source = ? WHERE code = ?', (name, created['id'], period, interval_count, int(round(amount_inr * 100)), currency, description, 'app', code))
    else:
        db.execute('INSERT INTO razorpay_plans (code, name, provider_plan_id, period, interval_count, amount, currency, description, active, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)', (code, name, created['id'], period, interval_count, int(round(amount_inr * 100)), currency, description, 'app'))
    db.commit()
    return {'ok': True, 'plan': {'code': code, 'provider_plan_id': created['id']}}

@app.post('/api/admin/razorpay-plans/<int:plan_id>/activate')
@login_required
@admin_required
def admin_activate_razorpay_plan(plan_id):
    db = get_db(); db.execute('UPDATE razorpay_plans SET active = 1 WHERE id = ?', (plan_id,)); db.commit(); return {'ok': True}

@app.post('/api/admin/razorpay-plans/<int:plan_id>/deactivate')
@login_required
@admin_required
def admin_deactivate_razorpay_plan(plan_id):
    db = get_db(); db.execute('UPDATE razorpay_plans SET active = 0 WHERE id = ?', (plan_id,)); db.commit(); return {'ok': True}

@app.post('/api/payments/verify')
@login_required
def payments_verify():
    data = request.get_json(force=True)
    order_id = data.get('razorpay_order_id'); payment_id = data.get('razorpay_payment_id'); signature = data.get('razorpay_signature')
    if not order_id or not payment_id or not signature:
        return {'error': 'Missing payment verification fields.'}, 400
    if not verify_signature(order_id, payment_id, signature):
        return {'error': 'Invalid payment signature.'}, 400
    db = get_db()
    payment = db.execute('SELECT * FROM payments WHERE razorpay_order_id = ? AND user_id = ?', (order_id, current_user.id)).fetchone()
    if not payment:
        return {'error': 'Payment record not found.'}, 404
    db.execute('UPDATE payments SET razorpay_payment_id = ?, razorpay_signature = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE razorpay_order_id = ?', (payment_id, signature, 'paid', order_id))
    db.execute("UPDATE users SET is_paid = 1, plan = 'pro' WHERE id = ?", (current_user.id,))
    db.commit()
    return {'ok': True, 'plan': 'pro', 'is_paid': True}

@app.post('/api/payments/webhook')
@limiter.exempt
def payments_webhook():
    raw_body = request.get_data(); signature = request.headers.get('X-Razorpay-Signature', '')
    if not verify_webhook_signature(raw_body, signature):
        return {'error': 'Invalid webhook signature.'}, 400
    payload = request.get_json(force=True, silent=True) or {}
    event = payload.get('event', '')
    entity_payment = ((payload.get('payload') or {}).get('payment') or {}).get('entity') or {}
    entity_subscription = ((payload.get('payload') or {}).get('subscription') or {}).get('entity') or {}
    event_id = entity_payment.get('id') or entity_subscription.get('id')
    if not _record_webhook_event('razorpay', event_id, event, raw_body):
        return {'ok': True, 'duplicate': True}
    db = get_db()
    if event == 'payment.captured':
        order_id = entity_payment.get('order_id'); payment_id = entity_payment.get('id')
        payment = db.execute('SELECT * FROM payments WHERE razorpay_order_id = ?', (order_id,)).fetchone()
        if payment:
            db.execute('UPDATE payments SET razorpay_payment_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE razorpay_order_id = ?', (payment_id, 'paid', order_id))
            db.execute("UPDATE users SET is_paid = 1, plan = 'pro' WHERE id = ?", (payment['user_id'],))
            db.commit()
    elif event.startswith('subscription.'):
        subscription_id = entity_subscription.get('id'); status = entity_subscription.get('status', 'unknown'); paid_count = entity_subscription.get('paid_count') or 0; current_start = entity_subscription.get('current_start'); current_end = entity_subscription.get('current_end')
        sub = db.execute('SELECT * FROM subscriptions WHERE provider_subscription_id = ?', (subscription_id,)).fetchone()
        if sub:
            grace_days = int(app.config['SUBSCRIPTION_GRACE_DAYS'])
            grace_until = None
            retry_count = sub['billing_retry_count'] or 0
            if status == 'pending':
                retry_count += 1
                grace_until = to_db_ts(utcnow() + timedelta(days=grace_days))
            elif status in {'halted', 'cancelled', 'completed'}:
                grace_until = to_db_ts(utcnow() + timedelta(days=grace_days))
            elif status in {'active', 'authenticated', 'resumed'}:
                retry_count = 0
            db.execute('UPDATE subscriptions SET status = ?, started_at = COALESCE(started_at, ?), expires_at = ?, grace_until = COALESCE(?, grace_until), billing_retry_count = ?, last_payment_failed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE provider_subscription_id = ?', (status, to_db_ts(parse_dt(current_start) or utcnow()), to_db_ts(parse_dt(current_end)), grace_until, retry_count, to_db_ts(utcnow()) if status in {'pending', 'halted'} else None, subscription_id))
            if status in {'active', 'authenticated', 'resumed'} or (paid_count and int(paid_count) > 0):
                feature_plan = 'standard' if str(sub['plan_code']).startswith('standard_') else 'pro'
                db.execute('UPDATE users SET is_paid = 1, plan = ? WHERE id = ?', (feature_plan, sub['user_id']))
            db.commit()
    return {'ok': True}



@app.post('/api/rewrite')
@login_required
def rewrite_resume():
    data = request.get_json(force=True)
    resume_text = (data.get('resume_text') or '').strip()
    job_description = (data.get('job_description') or '').strip()
    if not resume_text:
        return {'error': 'Resume text is required.'}, 400
    result = build_rewrite_suggestions(resume_text, job_description or resume_text)
    return {'result': result}

@app.post('/api/feedback')
@login_required
def submit_feedback():
    data = request.get_json(force=True)
    rating = int(data.get('rating') or 0)
    message = (data.get('message') or '').strip()
    if rating < 1 or rating > 5:
        return {'error': 'Rating must be between 1 and 5.'}, 400
    db = get_db()
    db.execute(
        'INSERT INTO feedback (user_id, rating, message) VALUES (?, ?, ?)',
        (current_user.id, rating, message),
    )
    db.commit()
    return {'ok': True, 'message': 'Feedback submitted successfully.'}

@app.get('/api/admin/feedback')
@login_required
@admin_required
def admin_feedback():
    db = get_db()
    rows = db.execute(
        'SELECT feedback.id, feedback.rating, feedback.message, feedback.created_at, users.email '
        'FROM feedback JOIN users ON users.id = feedback.user_id '
        'ORDER BY feedback.id DESC LIMIT 50'
    ).fetchall()
    return {'items': [dict(r) for r in rows]}


@app.get('/api/dashboard-analytics')
@login_required
def dashboard_analytics():
    db = get_db()
    rows = db.execute('SELECT result_json FROM analyses WHERE user_id = ? ORDER BY id DESC', (current_user.id,)).fetchall()
    parsed = [json.loads(r['result_json']) for r in rows]
    scores = [int(p.get('ats_score') or 0) for p in parsed if p.get('ats_score') is not None]
    missing_counter = {}
    for p in parsed:
        for item in p.get('missing_skills', [])[:8]:
            missing_counter[item] = missing_counter.get(item, 0) + 1
    common_missing = [k for k, _ in sorted(missing_counter.items(), key=lambda x: (-x[1], x[0]))[:8]]
    return {
        'total_analyses': len(parsed),
        'average_ats_score': round(sum(scores) / len(scores), 1) if scores else 0,
        'best_score': max(scores) if scores else 0,
        'common_missing_skills': common_missing,
        'recent_scores': scores[:8],
    }

@app.get('/api/profile')
@login_required
def get_profile():
    db = get_db()
    row = db.execute('SELECT full_name, target_role, experience_level, preferred_industry FROM user_profiles WHERE user_id = ?', (current_user.id,)).fetchone()
    return {'profile': dict(row) if row else {'full_name': '', 'target_role': '', 'experience_level': '', 'preferred_industry': ''}}

@app.post('/api/profile')
@login_required
def save_profile():
    data = request.get_json(force=True)
    full_name = (data.get('full_name') or '').strip()
    target_role = (data.get('target_role') or '').strip()
    experience_level = (data.get('experience_level') or '').strip()
    preferred_industry = (data.get('preferred_industry') or '').strip()
    db = get_db()
    existing = db.execute('SELECT id FROM user_profiles WHERE user_id = ?', (current_user.id,)).fetchone()
    if existing:
        db.execute('UPDATE user_profiles SET full_name = ?, target_role = ?, experience_level = ?, preferred_industry = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                   (full_name, target_role, experience_level, preferred_industry, current_user.id))
    else:
        db.execute('INSERT INTO user_profiles (user_id, full_name, target_role, experience_level, preferred_industry) VALUES (?, ?, ?, ?, ?)',
                   (current_user.id, full_name, target_role, experience_level, preferred_industry))
    db.commit()
    return {'ok': True}

@app.get('/api/saved-jds')
@login_required
def list_saved_jds():
    db = get_db()
    rows = db.execute('SELECT id, title, company, description, created_at FROM saved_job_descriptions WHERE user_id = ? ORDER BY id DESC', (current_user.id,)).fetchall()
    return {'items': [dict(r) for r in rows]}

@app.post('/api/saved-jds')
@login_required
def create_saved_jd():
    data = request.get_json(force=True)
    title = (data.get('title') or '').strip()
    company = (data.get('company') or '').strip()
    description = (data.get('description') or '').strip()
    if not title or not description:
        return {'error': 'Title and description are required.'}, 400
    db = get_db()
    db.execute('INSERT INTO saved_job_descriptions (user_id, title, company, description) VALUES (?, ?, ?, ?)',
               (current_user.id, title, company, description))
    db.commit()
    return {'ok': True}

@app.post('/api/cover-letter')
@login_required
def cover_letter():
    from services.ai_service import generate_cover_letter
    data = request.get_json(force=True)
    resume_text = (data.get('resume_text') or '').strip()
    job_description = (data.get('job_description') or '').strip()
    if not resume_text or not job_description:
        return {'error': 'Resume text and job description are required.'}, 400
    return {'result': generate_cover_letter(resume_text, job_description)}

@app.post('/api/interview-questions')
@login_required
def interview_questions():
    from services.ai_service import generate_interview_questions
    data = request.get_json(force=True)
    resume_text = (data.get('resume_text') or '').strip()
    job_description = (data.get('job_description') or '').strip()
    if not resume_text or not job_description:
        return {'error': 'Resume text and job description are required.'}, 400
    return {'result': generate_interview_questions(resume_text, job_description)}



@app.post('/api/mock-interview/start')
@login_required
def mock_interview_start():
    data = request.get_json(force=True)
    resume_text = (data.get('resume_text') or '').strip()
    job_description = (data.get('job_description') or '').strip()
    target_role = (data.get('target_role') or '').strip()
    if not resume_text:
        return {'error': 'Resume text is required.'}, 400
    questions = build_resume_based_mock_interview(resume_text, job_description, target_role)
    db = get_db()
    db.execute(
        'INSERT INTO mock_interview_sessions (user_id, target_role, resume_text, job_description, questions_json) VALUES (?, ?, ?, ?, ?)',
        (current_user.id, target_role, resume_text[:12000], job_description[:8000], json.dumps(questions)),
    )
    db.commit()
    return {'result': questions}


@app.post('/api/mock-interview/evaluate')
@login_required
def mock_interview_evaluate():
    data = request.get_json(force=True)
    question = (data.get('question') or '').strip()
    answer = (data.get('answer') or '').strip()
    if not question:
        return {'error': 'Question is required.'}, 400
    return {'result': evaluate_mock_answer(question, answer)}

@app.get('/api/dsa/status')
@login_required
def dsa_status():
    db = get_db()
    row = ensure_dsa_profile(current_user.id)
    subs = db.execute('SELECT title, difficulty, score, created_at FROM dsa_submissions WHERE user_id = ? ORDER BY id DESC LIMIT 20', (current_user.id,)).fetchall()
    entries = [
        {'user_id': row['user_id'], 'name': current_user.username, 'solved': row['total_solved'], 'rating': row['rating']}
    ]
    offset = 1000
    for idx, item in enumerate(DEFAULT_LEADERBOARD, start=1):
        entries.append({'user_id': offset + idx, 'name': item['name'], 'solved': item['solved'], 'rating': item['rating']})
    rank, ordered = calc_user_rank(entries, current_user.id)
    ahead = max((rank or 1) - 1, 0)
    behind = max(len(ordered) - (rank or len(ordered)), 0)
    percentile = round(((behind + 1) / max(len(ordered), 1)) * 100, 1)
    leaderboard = ordered[:10]
    return {
        'profile': dict(row),
        'rank': rank,
        'people_ahead': ahead,
        'people_behind': behind,
        'percentile': percentile,
        'leaderboard': leaderboard,
        'recent_submissions': [dict(r) for r in subs],
        'band': competitive_band(profile.get('rating', 0)),
    }

@app.post('/api/dsa/submit')
@login_required
def dsa_submit():
    data = request.get_json(force=True)
    title = (data.get('title') or '').strip()
    difficulty = (data.get('difficulty') or 'easy').strip().lower()
    score = int(data.get('score') or 0)
    if not title:
        return {'error': 'Problem title is required.'}, 400
    if difficulty not in {'easy', 'medium', 'hard'}:
        return {'error': 'Difficulty must be easy, medium, or hard.'}, 400
    db = get_db()
    ensure_dsa_profile(current_user.id)
    db.execute('INSERT INTO dsa_submissions (user_id, title, difficulty, score, solved) VALUES (?, ?, ?, ?, 1)', (current_user.id, title, difficulty, score))
    inc = {'easy': 1, 'medium': 2, 'hard': 3}[difficulty]
    rating_inc = {'easy': 8, 'medium': 18, 'hard': 32}[difficulty] + max(score, 0)
    if difficulty == 'easy':
        db.execute('UPDATE dsa_profiles SET total_solved = total_solved + ?, easy_solved = easy_solved + 1, rating = rating + ?, streak_days = streak_days + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', (inc, rating_inc, current_user.id))
    elif difficulty == 'medium':
        db.execute('UPDATE dsa_profiles SET total_solved = total_solved + ?, medium_solved = medium_solved + 1, rating = rating + ?, streak_days = streak_days + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', (inc, rating_inc, current_user.id))
    else:
        db.execute('UPDATE dsa_profiles SET total_solved = total_solved + ?, hard_solved = hard_solved + 1, rating = rating + ?, streak_days = streak_days + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', (inc, rating_inc, current_user.id))
    db.commit()
    return {'ok': True}

@app.get('/api/admin/feedback-analytics')
@login_required
@admin_required
def admin_feedback_analytics():
    db = get_db()
    rows = db.execute('SELECT rating, message FROM feedback').fetchall()
    items = [dict(r) for r in rows]
    count = len(items)
    avg = round(sum(i['rating'] for i in items) / count, 1) if count else 0
    complaints = []
    for marker in ['slow', 'bug', 'error', 'payment', 'login', 'ui', 'analysis']:
        hits = sum(1 for i in items if marker in (i.get('message') or '').lower())
        if hits:
            complaints.append({'topic': marker, 'count': hits})
    return {'average_rating': avg, 'common_topics': complaints, 'count': count}

@app.get('/api/admin/overview')
@login_required
@admin_required
def admin_overview():
    db = get_db()
    stats = {
        'users': db.execute('SELECT COUNT(*) AS c FROM users').fetchone()['c'],
        'paid_users': db.execute('SELECT COUNT(*) AS c FROM users WHERE is_paid = 1').fetchone()['c'],
        'analyses': db.execute('SELECT COUNT(*) AS c FROM analyses').fetchone()['c'],
        'payments': db.execute("SELECT COUNT(*) AS c FROM payments WHERE status = 'paid'").fetchone()['c'],
        'subscriptions': db.execute('SELECT COUNT(*) AS c FROM subscriptions').fetchone()['c'],
        'razorpay_plans': db.execute('SELECT COUNT(*) AS c FROM razorpay_plans WHERE active = 1').fetchone()['c'],
        'feedback_count': db.execute('SELECT COUNT(*) AS c FROM feedback').fetchone()['c'],
        'mock_interviews': db.execute('SELECT COUNT(*) AS c FROM mock_interview_sessions').fetchone()['c'],
        'dsa_profiles': db.execute('SELECT COUNT(*) AS c FROM dsa_profiles').fetchone()['c'],
        'dsa_submissions': db.execute('SELECT COUNT(*) AS c FROM dsa_submissions').fetchone()['c'],
    }
    users = db.execute('SELECT id, username, email, plan, is_paid, email_verified, role, created_at FROM users ORDER BY id DESC LIMIT 50').fetchall()
    return {'stats': stats, 'users': [dict(u) for u in users], 'feedback_meta': summarize_feedback()}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
