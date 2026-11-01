import os
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
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture
def client(db):
    def override():
        yield db
    app.dependency_overrides[get_db] = override
    # O lifespan consulta o banco de teste configurado acima; seed fica desligado.
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
