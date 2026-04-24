# SkillScan v23 Polished Final — Run Guide

## Backend
```bat
cd server
py -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install setuptools
python -m pip install psycopg[binary]
python -m pip install -r requirements.txt
python init_db.py
python app.py
```

Backend health check:
```text
http://localhost:5000/api/health
```

## Frontend
```bat
cd client
npm install
npm run dev
```

Open:
```text
http://localhost:5173
```

## Required env files

Create `server/.env`:
```env
SECRET_KEY=dev-secret
DATABASE_URL=
DATABASE_PATH=skillscan.db
ANTHROPIC_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
CLIENT_ORIGIN=http://localhost:5173
APP_BASE_URL=http://localhost:5000
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=Lax
RATELIMIT_STORAGE_URI=memory://
SUBSCRIPTION_GRACE_DAYS=3
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=no-reply@skillscan.local
SMTP_USE_TLS=true
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=no-reply@example.com
```

Create `client/.env`:
```env
VITE_API_BASE_URL=/api
VITE_RAZORPAY_KEY_ID=
```

Payment is intentionally paused until Razorpay setup is ready.
