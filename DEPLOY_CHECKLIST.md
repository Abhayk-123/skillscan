# Deploy Checklist

- fill server/.env
- choose SQLite for dev or DATABASE_URL for PostgreSQL
- set Razorpay keys and webhook secret
- set SendGrid or SMTP credentials
- create admin user
- create Razorpay plans from Admin
- test one-time and recurring payments in test mode
- point webhook to /api/payments/webhook
