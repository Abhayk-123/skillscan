import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from flask import current_app

try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
except Exception:
    SendGridAPIClient = None
    Mail = None


def send_email(to_email: str, subject: str, body: str, html_body: str | None = None):
    api_key = current_app.config.get('SENDGRID_API_KEY')
    if api_key and SendGridAPIClient and Mail:
        message = Mail(
            from_email=current_app.config.get('SENDGRID_FROM_EMAIL'),
            to_emails=to_email,
            subject=subject,
            plain_text_content=body,
            html_content=html_body or body.replace('\n', '<br>'),
        )
        response = SendGridAPIClient(api_key).send(message)
        return {'delivered': 200 <= response.status_code < 300, 'mode': 'sendgrid', 'status_code': response.status_code}

    host = current_app.config.get('SMTP_HOST')
    if host:
        message = MIMEMultipart('alternative')
        message['Subject'] = subject
        message['From'] = current_app.config.get('SMTP_FROM')
        message['To'] = to_email
        message.attach(MIMEText(body, 'plain', 'utf-8'))
        if html_body:
            message.attach(MIMEText(html_body, 'html', 'utf-8'))
        with smtplib.SMTP(host, current_app.config.get('SMTP_PORT', 587), timeout=20) as server:
            if current_app.config.get('SMTP_USE_TLS', True):
                server.starttls()
            username = current_app.config.get('SMTP_USERNAME')
            password = current_app.config.get('SMTP_PASSWORD')
            if username:
                server.login(username, password)
            server.send_message(message)
        return {'delivered': True, 'mode': 'smtp'}

    print('=' * 60)
    print(f'TO: {to_email}')
    print(f'SUBJECT: {subject}')
    print(body)
    if html_body:
        print(html_body)
    print('=' * 60)
    return {'delivered': True, 'mode': 'console'}
