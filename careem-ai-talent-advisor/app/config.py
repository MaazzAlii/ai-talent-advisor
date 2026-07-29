import os
from typing import ClassVar, Dict, Optional
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
    LLM_MODEL: str = "openai/gpt-oss-120b"
    PORT: int = 8000

    # Text-scoring model used per provider when no override is supplied.
    # Both are current, full-size flagship models on purpose -- this project
    # intentionally avoids "small"/"mini" tier models for evaluation quality.
    DEFAULT_MODELS: ClassVar[Dict[str, str]] = {
        "groq": "openai/gpt-oss-120b",          # Groq's large flagship (120B) model
        "mistral": "mistral-large-latest",       # Mistral Large 3 - flagship reasoning model
    }

    # Model used to convert PDF/image resumes straight to Markdown via Mistral's
    # dedicated OCR endpoint (POST /v1/ocr) -- one fast call per file, no local
    # document-parsing library needed.
    MISTRAL_OCR_MODEL: str = "mistral-ocr-latest"

    @property
    def api_key(self) -> Optional[str]:
        if self.LLM_PROVIDER == "groq":
            return self.GROQ_API_KEY
        elif self.LLM_PROVIDER == "mistral":
            return self.MISTRAL_API_KEY
        return None

    def set_provider(self, provider: str, model: Optional[str] = None):
        provider_clean = provider.lower().strip()
        if provider_clean not in ["groq", "mistral"]:
            raise ValueError(f"Unsupported LLM provider '{provider}'. Must be 'groq' or 'mistral'.")
        self.LLM_PROVIDER = provider_clean
        self.LLM_MODEL = model if model else self.DEFAULT_MODELS[provider_clean]


settings = Settings()
