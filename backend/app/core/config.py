import os
from typing import Optional
from pydantic_settings import BaseSettings

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DEFAULT_DB_PATH = os.path.join(_BASE_DIR, "cantill.db")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Corvo Procurement Engine"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_DB_PATH}")
    
    # AI Configuration - Centralized Gemini settings
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GEMINI_FALLBACK_MODEL: str = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-1.5-flash")
    
    BASE_DIR: str = _BASE_DIR
    DATA_DIR: str = os.path.dirname(_BASE_DIR)

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
