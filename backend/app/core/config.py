import os
from dataclasses import dataclass
from sqlalchemy.engine import URL


@dataclass(frozen=True)
class Settings:
    database_url: str | URL
    jwt_secret_key: str
    jwt_exp_minutes: int
    frontend_origins: tuple[str, ...]
    seed_demo_users: bool
    demo_password: str
    app_env: str


def get_settings() -> Settings:
    key = os.getenv("JWT_SECRET_KEY", "")
    if len(key) < 32 or key.startswith("SUBSTITUA_"):
        raise RuntimeError("JWT_SECRET_KEY deve conter pelo menos 32 caracteres.")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        # URL.create faz o escape da senha: caracteres @, :, /, #, etc. são aceitos.
        password = os.getenv("DB_PASSWORD")
        if not password:
            raise RuntimeError("Defina DATABASE_URL ou DB_PASSWORD para acessar o banco.")
        database_url = URL.create(
            "postgresql+psycopg",
            username=os.getenv("DB_USER", "prato"),
            password=password,
            host=os.getenv("DB_HOST", "db"),
            port=int(os.getenv("DB_PORT", "5432")),
            database=os.getenv("DB_NAME", "prato_conectado"),
        )
    minutes = int(os.getenv("JWT_EXP_MINUTES", "60"))
    if not 1 <= minutes <= 1440:
        raise RuntimeError("JWT_EXP_MINUTES deve estar entre 1 e 1440.")
    origins = tuple(x.strip() for x in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",") if x.strip())
    env = os.getenv("APP_ENV", "development")
    seed = os.getenv("SEED_DEMO_USERS", "false").lower() == "true"
    if seed and env != "development":
        raise RuntimeError("SEED_DEMO_USERS só é permitido em desenvolvimento.")
    return Settings(database_url, key, minutes, origins, seed,
                    os.getenv("DEMO_PASSWORD", ""), env)


settings = get_settings()
