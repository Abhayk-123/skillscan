from flask_login import UserMixin
from db import get_db

class User(UserMixin):
    def __init__(self, row):
        self.id = row['id']
        self.username = row['username']
        self.email = row['email']
        self.plan = row['plan']
        self.free_analyses_used = row['free_analyses_used']
        self.is_paid = row['is_paid']
        self.email_verified = row['email_verified']
        self.role = row['role']

def load_user_by_id(user_id: int):
    db = get_db()
    row = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    return User(row) if row else None
