from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "FIN-SHIELD"
    environment: str = "development"
    database_url: str = f"sqlite:///{ROOT_DIR / 'data' / 'finshield.db'}"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    similarity_threshold: float = 0.72
    upload_dir: str = str(ROOT_DIR / "data" / "uploads")
    max_upload_bytes: int = 5 * 1024 * 1024
    shared_entity_alert_threshold: int = 3
    high_risk_min_score: int = 50
    log_level: str = "INFO"

    # NVIDIA Nemotron AI Investigation Copilot
    nvidia_api_key: Optional[str] = None
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model: str = "nvidia/nemotron-3.5-lightning-30b-a3b"
    nvidia_timeout_seconds: float = 45.0
    nvidia_max_tokens: int = 2048

    # Fallback / Alternative Copilot Providers
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-3.8-flash"
    gemini_timeout_seconds: float = 30.0
    gemini_max_output_tokens: int = 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
