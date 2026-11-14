import time
from pathlib import Path
from sqlalchemy import JSON, ForeignKey, Integer, String, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[int] = mapped_column(default=lambda: int(time.time()))


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[int] = mapped_column(index=True)


class Dataset(Base):
    __tablename__ = "datasets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    observations: Mapped[list] = mapped_column(JSON)
    row_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[int] = mapped_column(default=lambda: int(time.time()))
    updated_at: Mapped[int] = mapped_column(default=lambda: int(time.time()))


class CachedResource(Base):
    __tablename__ = "cached_resources"
    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    fetched_at: Mapped[int] = mapped_column(Integer)


class RateBucket(Base):
    __tablename__ = "rate_buckets"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[int] = mapped_column(Integer, index=True)


class Database:
    def __init__(self, settings):
        sqlite = settings.database_url.startswith("sqlite:")
        if sqlite:
            filename = settings.database_url.removeprefix("sqlite:///")
            if filename != ":memory:":
                Path(filename).parent.mkdir(parents=True, exist_ok=True)
        options = {"connect_args": {"check_same_thread": False, "timeout": 15}} if sqlite else {"poolclass": NullPool}
        self.engine = create_engine(settings.database_url, pool_pre_ping=True, **options)
        if sqlite:
            @event.listens_for(self.engine, "connect")
            def configure(connection, _):
                connection.execute("PRAGMA foreign_keys=ON")
                connection.execute("PRAGMA journal_mode=WAL")
        self.session = sessionmaker(self.engine, expire_on_commit=False)

    def initialize(self):
        Base.metadata.create_all(self.engine)
