import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import issue_access_token, read_access_token, verify_password
from app.db.session import get_db
from app.models import CredencialLocal, Organizacao, Usuario

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])
bearer = HTTPBearer(auto_error=False)


class LoginPayload(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=256)


class UsuarioPublico(BaseModel):
    id: str  # id da organização quando existente (compatibilidade com a interface mock)
    usuario_id: str
    nome: str
    email: EmailStr
    responsavel: str
    tipo: str
    perfil: str
    status: str
    papel_sistema: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    usuario: UsuarioPublico


def get_user_view(db: Session, usuario: Usuario) -> UsuarioPublico:
    # A organização define o perfil, nunca o corpo da requisição de login.
    org = db.scalar(select(Organizacao).where(
        Organizacao.usuario_responsavel_id == usuario.id
    ).order_by(Organizacao.criado_em, Organizacao.id).limit(1))
    return UsuarioPublico(
        id=str(org.id if org else usuario.id),
        usuario_id=str(usuario.id),
        nome=org.nome if org else usuario.nome,
        email=usuario.email,
        responsavel=usuario.nome,
        tipo=org.tipo if org else "SEM_ORGANIZACAO",
        perfil="ONG" if org and org.tipo == "ONG" else "EMPRESA" if org else "SEM_ORGANIZACAO",
        status=org.status_verificacao if org else "PENDENTE",
        papel_sistema=usuario.papel_sistema,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    usuario = db.scalar(select(Usuario).where(func.lower(Usuario.email) == email))
    credencial = db.get(CredencialLocal, usuario.id) if usuario else None
    if not usuario or not usuario.ativo or not credencial or not verify_password(payload.senha, credencial.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos.")
    return LoginResponse(
        access_token=issue_access_token(usuario.id),
        expires_in=settings.jwt_exp_minutes * 60,
        usuario=get_user_view(db, usuario),
    )


def current_user(
    authorization: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not authorization or authorization.scheme.lower() != "bearer":
        raise unauthorized
    try:
        usuario_id = read_access_token(authorization.credentials)
    except jwt.PyJWTError:
        raise unauthorized from None
    usuario = db.get(Usuario, usuario_id)
    if usuario is None or not usuario.ativo:
        raise unauthorized
    return usuario


@router.get("/me", response_model=UsuarioPublico)
def me(usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    return get_user_view(db, usuario)
