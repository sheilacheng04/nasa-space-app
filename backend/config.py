from dataclasses import dataclass, field
from pathlib import Path
import os
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", f"sqlite:///{(ROOT / '.storage/pacific.db').as_posix()}"))
    production: bool = field(default_factory=lambda: os.getenv("APP_ENV") == "production" or os.getenv("VERCEL") == "1")
    origin: str = field(default_factory=lambda: os.getenv("APP_ORIGIN", "").rstrip("/"))
    ai_enabled: bool = field(default_factory=lambda: os.getenv("AI_ENABLED", "false") == "true")
    ai_key: str = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    ai_model: str = field(default_factory=lambda: os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"))
    data_dir: Path = ROOT / "public/data"
    session_seconds: int = 7 * 24 * 60 * 60

    def __post_init__(self):
        url = self.database_url
        if url.startswith(("postgres://", "postgresql://")):
            url = "postgresql+psycopg://" + url.split("://", 1)[1]
            object.__setattr__(self, "database_url", url)
        if self.production and not url.startswith("postgresql+psycopg://"):
            raise RuntimeError("Production requires a persistent PostgreSQL DATABASE_URL. SQLite is for local development.")
        if self.production and not self.origin.startswith("https://"):
            raise RuntimeError("Set APP_ORIGIN to this deployment's https:// origin.")
