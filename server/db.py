from __future__ import annotations
import sqlite3
from flask import g, current_app

try:
    import psycopg2
    import psycopg2.extras
except Exception:
    psycopg2 = None

class ResultWrapper:
    def __init__(self, cursor):
        self.cursor = cursor
    def fetchone(self):
        return self.cursor.fetchone()
    def fetchall(self):
        return self.cursor.fetchall()

class DBWrapper:
    def __init__(self, conn, driver: str):
        self.conn = conn
        self.driver = driver
    def execute(self, query: str, params=()):
        params = params or ()
        if self.driver == 'postgres':
            query = query.replace('?', '%s')
            cur = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(query, params)
            return ResultWrapper(cur)
        cur = self.conn.cursor()
        cur.execute(query, params)
        return ResultWrapper(cur)
    def commit(self):
        self.conn.commit()
    def rollback(self):
        self.conn.rollback()
    def close(self):
        self.conn.close()


def get_db():
    if 'db' in g:
        return g.db
    database_url = current_app.config.get('DATABASE_URL')
    if database_url:
        if psycopg2 is None:
            raise RuntimeError('psycopg2-binary is required for PostgreSQL support.')
        conn = psycopg2.connect(database_url)
        g.db = DBWrapper(conn, 'postgres')
    else:
        conn = sqlite3.connect(current_app.config['DATABASE_PATH'])
        conn.row_factory = sqlite3.Row
        g.db = DBWrapper(conn, 'sqlite')
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()
