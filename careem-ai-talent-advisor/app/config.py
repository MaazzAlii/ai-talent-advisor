import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    GROQ_API_KEY: Optional[str] = None
    MISTRAL_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "groq"
    LLM_MODEL: str = "llama-3.3-70b-versatile"
    PORT: int = 8000

    @property
    def api_key(self) -> Optional[str]:
        if self.LLM_PROVIDER == "groq":
            return self.GROQ_API_KEY
        elif self.LLM_PROVIDER == "mistral":
            return self.MISTRAL_API_KEY
        return None

settings = Settings()
