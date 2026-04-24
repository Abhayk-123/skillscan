import os
from dotenv import load_dotenv

load_dotenv()

def _bool(name: str, default: str = 'false') -> bool:
    return os.getenv(name, default).lower() in {'1', 'true', 'yes', 'on'}

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret')
    DATABASE_URL = os.getenv('DATABASE_URL', '')
    DATABASE_PATH = os.getenv('DATABASE_PATH', 'skillscan.db')
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
    RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID', '')
    RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET', '')
    RAZORPAY_WEBHOOK_SECRET = os.getenv('RAZORPAY_WEBHOOK_SECRET', '')
    CLIENT_ORIGIN = os.getenv('CLIENT_ORIGIN', 'http://localhost:5173')
    APP_BASE_URL = os.getenv('APP_BASE_URL', 'http://localhost:5000')
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', str(5 * 1024 * 1024)))
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')
    SESSION_COOKIE_SECURE = _bool('SESSION_COOKIE_SECURE', 'false')
    REMEMBER_COOKIE_SECURE = _bool('SESSION_COOKIE_SECURE', 'false')
    SMTP_HOST = os.getenv('SMTP_HOST', '')
    SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
    SMTP_USERNAME = os.getenv('SMTP_USERNAME', '')
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
    SMTP_FROM = os.getenv('SMTP_FROM', 'no-reply@skillscan.local')
    SMTP_USE_TLS = _bool('SMTP_USE_TLS', 'true')
    SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY', '')
    SENDGRID_FROM_EMAIL = os.getenv('SENDGRID_FROM_EMAIL', SMTP_FROM)
    RATELIMIT_STORAGE_URI = os.getenv('RATELIMIT_STORAGE_URI', 'memory://')
    SUBSCRIPTION_GRACE_DAYS = int(os.getenv('SUBSCRIPTION_GRACE_DAYS', '3'))
