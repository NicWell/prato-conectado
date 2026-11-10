import os
from pathlib import Path
from uuid import uuid4
os.environ["JWT_SECRET_KEY"] = "chave-para-testes-automatizados-apenas-com-mais-de-32-caracteres"
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["SEED_DEMO_USERS"] = "false"
os.environ["APP_ENV"] = "development"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.db.session import get_db
from app.main import app
from app.models.entities import Base


@pytest.fixture
def db():
    test_url = os.getenv("TEST_DATABASE_URL")
    if test_url:
        # Nunca usa DATABASE_URL/.env do projeto. Cada teste tem seu próprio schema.
        admin = create_engine(test_url)
        schema = "teste_" + uuid4().hex
        with admin.begin() as conn:
            conn.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
        engine = create_engine(test_url, connect_args={"options": f"-csearch_path={schema}"})
        scripts = Path(__file__).resolve().parents[2] / "database"
        with engine.connect() as conn:
            for script in ("schema_postgresql.sql", "002_credenciais_locais.sql", "003_cadastro_real.sql"):
                conn.connection.driver_connection.execute((scripts / script).read_text(encoding="utf-8"))
                conn.commit()
    else:
        engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            yield session
    finally:
        engine.dispose()
        if test_url:
            with admin.begin() as conn:
                conn.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
            admin.dispose()


@pytest.fixture
def client(db):
    def override():
        yield db
    app.dependency_overrides[get_db] = override
    # O lifespan consulta o banco de teste configurado acima; seed fica desligado.
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
