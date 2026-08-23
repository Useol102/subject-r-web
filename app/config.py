"""환경 설정. .env 파일에서 읽는다."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # psycopg3이므로 스킴은 postgresql+psycopg (뒤에 2를 붙이지 않는다)
    DATABASE_URL: str = "postgresql+psycopg://postgres:devpass@localhost:5432/robotdb"

    SECRET_KEY: str = "CHANGE_ME"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # 이 시간 동안 보고가 없으면 대시보드에서 "연결 끊김"으로 본다
    ROBOT_STALE_SECONDS: int = 60

    # 로봇 터치스크린 / 대시보드가 붙을 주소
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
