from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql://proptech:proptech@db:5432/proptech"
    redis_url: str = "redis://redis:6379/0"
    gemini_api_key: str = ""
    itp_rate: float = 0.07
    honorarios_notaria: float = 3000.0
    coste_reforma_m2: float = 900.0
    scraper_min_delay: int = 3
    scraper_max_delay: int = 7
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
