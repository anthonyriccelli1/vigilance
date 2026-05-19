from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://vigilance:vigilance_dev@localhost:5432/vigilance_db"
    anthropic_api_key: str = "placeholder"
    environment: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
