"""
db.py — database engine. Postgres if DATABASE_URL is set, else local SQLite.
The app boots either way; Postgres is a drop-in upgrade.
"""
import os
from pathlib import Path
from functools import lru_cache

from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

BASE = Path(__file__).resolve().parent
SQLITE_PATH = BASE / "prettyfly.db"


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        # SQLAlchemy wants postgresql://, Heroku-style gives postgres://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url
    return f"sqlite:///{SQLITE_PATH}"


@lru_cache(maxsize=1)
def get_engine():
    url = database_url()
    kw: dict = {}
    if url.startswith("sqlite"):
        kw["connect_args"] = {"check_same_thread": False}
    elif url.startswith("postgresql"):
        # psycopg2-binary is optional; skip postgres if it can't be imported
        try:
            import psycopg2  # noqa: F401
        except ImportError:
            import warnings
            warnings.warn("psycopg2 not installed — falling back to SQLite", stacklevel=2)
            sqlite_url = f"sqlite:///{SQLITE_PATH}"
            kw = {"connect_args": {"check_same_thread": False}}
            return create_engine(sqlite_url, **kw, future=True)
    return create_engine(url, **kw, future=True)


def backend_name() -> str:
    return "postgres" if database_url().startswith("postgresql") else "sqlite"
