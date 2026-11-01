from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.api.auth import router as auth_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.seed import seed_demo_accounts


@asynccontextmanager
async def lifespan(app: FastAPI):
    # As tabelas são criadas pelo script SQL do PostgreSQL; a aplicação NÃO chama create_all.
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
        seed_demo_accounts(db)
    yield


app = FastAPI(title="Prato Conectado — API de Login", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.frontend_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router)


@app.get("/health", tags=["Infraestrutura"])
def health():
    return {"status": "ok"}


@app.get("/health/ready", tags=["Infraestrutura"])
def readiness():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ready"}
