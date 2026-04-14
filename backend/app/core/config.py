from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "HyrAI Proctoring API"
    DEBUG: bool = True
    
    # MongoDB
    MONGO_DETAILS: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "hyrai_db"
    # Mapping for .env DB_NAME
    DB_NAME: Optional[str] = "hyrai_db" 
    
    # Storage
    UPLOAD_DIR: str = "uploads"
    
    # SMTP Settings (from .env)
    MAIL_USERNAME: Optional[str] = None
    MAIL_PASSWORD: Optional[str] = None
    MAIL_FROM: Optional[str] = None
    MAIL_PORT: Optional[int] = 587
    MAIL_SERVER: Optional[str] = None
    MAIL_FROM_NAME: Optional[str] = None
    
    # Server Settings
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    
    # Security
    ALGORITHM: str = "HS256"
    SECRET_KEY: str = "SUPER_SECRET_KEY_REPLACE_IN_PROD"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 1 day

    class Config:
        env_file = "backend/.env" # Explicit path from root
        extra = "ignore"

settings = Settings()
