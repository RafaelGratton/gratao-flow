from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "gratao-flow"
    product_name: str = "Gratão Flow"
    company_name: str = "Gratão Uniformes"
    environment: str = "development"
    cors_origins: str = ""
    database_url: str
    secret_key: str
    access_token_expire_minutes: int = 60 * 8
    jwt_algorithm: str = "HS256"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
