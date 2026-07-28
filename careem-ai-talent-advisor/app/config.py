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
    LLM_PROVIDER: str = "mistral"
    LLM_MODEL: str = "mistral-large-latest"
    PORT: int = 8000

    @property
    def api_key(self) -> Optional[str]:
        if self.LLM_PROVIDER == "groq":
            return self.GROQ_API_KEY
        elif self.LLM_PROVIDER == "mistral":
            return self.MISTRAL_API_KEY
        return None

    def set_api_keys(self, mistral_key: Optional[str] = None, groq_key: Optional[str] = None):
        if mistral_key is not None:
            self.MISTRAL_API_KEY = mistral_key.strip() if mistral_key.strip() else None
        if groq_key is not None:
            self.GROQ_API_KEY = groq_key.strip() if groq_key.strip() else None

    def set_provider(self, provider: str, model: Optional[str] = None):
        provider_clean = provider.lower().strip()
        if provider_clean not in ["groq", "mistral"]:
            raise ValueError(f"Unsupported LLM provider '{provider}'. Must be 'groq' or 'mistral'.")
        self.LLM_PROVIDER = provider_clean
        if model:
            self.LLM_MODEL = model
        else:
            # Default to best model per provider
            self.LLM_MODEL = "mistral-large-latest" if provider_clean == "mistral" else "llama-3.3-70b-versatile"

settings = Settings()
