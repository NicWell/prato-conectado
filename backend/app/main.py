from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.api.auth import router as auth_router
from app.api.google import router as google_router
from app.api.admin import router as admin_router
from app.core.config import settings
from app.criar_admin import provisionar_administrador
from app.db.session import SessionLocal
from app.seed import seed_demo_accounts


@asynccontextmanager
async def lifespan(app: FastAPI):
    # As tabelas são criadas pelo script SQL do PostgreSQL; a aplicação NÃO chama create_all.
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
        provisionar_administrador(db)
        seed_demo_accounts(db)
    yield


app = FastAPI(title="Prato Conectado — Autenticação e Cadastro", version="0.3.0", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    # Erros de validação nunca devolvem senha, CPF ou o corpo recebido.
    erros = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": erros})


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.frontend_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router)
app.include_router(google_router)
app.include_router(admin_router)


@app.get("/health", tags=["Infraestrutura"])
def health():
    return {"status": "ok"}


@app.get("/health/ready", tags=["Infraestrutura"])
def readiness():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ready"}
