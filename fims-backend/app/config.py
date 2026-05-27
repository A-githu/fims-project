from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "fims_jwt_secret_key_256bits_production_2025_eneo_cameroun"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()