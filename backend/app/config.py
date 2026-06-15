from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    max_repo_size_mb: int = 200
    scan_timeout_seconds: int = 180
    max_findings_to_explain: int = 25
    tmp_repo_dir: str = "tmp_repos"
    cache_dir: str = "cache"
    cache_ttl_seconds: int = 604800  # 7 days

    class Config:
        env_file = ".env"


settings = Settings()
