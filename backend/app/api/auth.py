import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import issue_access_token, read_access_token, verify_password
from app.db.session import get_db
from app.models import AnaliseCadastro, CredencialLocal, DoadorPessoaFisica, Organizacao, Usuario
from app.schemas.cadastro import CadastroPayload, PerfilPayload
from app.services.cadastro import CadastroDuplicado, cadastrar_conta, completar_perfil

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])
bearer = HTTPBearer(auto_error=False)


class LoginPayload(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=256)


class UsuarioPublico(BaseModel):
    id: str  # id do perfil (organização ou doador PF); sem perfil, id da conta
    usuario_id: str
    nome: str
    email: EmailStr
    responsavel: str
    tipo: str
    perfil: str
    status: str
    papel_sistema: str
    cadastro_completo: bool
    google_vinculado: bool
    motivo_reprovacao: str | None = None


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
    pessoa = None if org else db.scalar(select(DoadorPessoaFisica).where(
        DoadorPessoaFisica.usuario_responsavel_id == usuario.id
    ))
    cadastro = org or pessoa
    motivo = None
    if cadastro and cadastro.status_verificacao == "REPROVADA":
        alvo = AnaliseCadastro.organizacao_id if org else AnaliseCadastro.doador_pf_id
        motivo = db.scalar(select(AnaliseCadastro.justificativa).where(alvo == cadastro.id)
                           .order_by(AnaliseCadastro.analisado_em.desc(), AnaliseCadastro.id).limit(1))
    tipo = org.tipo if org else "DOADOR" if pessoa else "SEM_ORGANIZACAO"
    if org:
        perfil = "ONG" if org.tipo == "ONG" else "EMPRESA"
    else:
        perfil = "PESSOA_FISICA" if pessoa else "SEM_ORGANIZACAO"
    return UsuarioPublico(
        id=str(cadastro.id if cadastro else usuario.id),
        usuario_id=str(usuario.id),
        nome=cadastro.nome if cadastro else usuario.nome,
        email=usuario.email,
        responsavel=usuario.nome,
        tipo=tipo,
        perfil=perfil,
        status=cadastro.status_verificacao if cadastro else "PENDENTE",
        papel_sistema=usuario.papel_sistema,
        cadastro_completo=cadastro is not None,
        google_vinculado=usuario.google_sub is not None,
        motivo_reprovacao=motivo,
    )


@router.post("/cadastro", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def cadastrar(payload: CadastroPayload, db: Session = Depends(get_db)):
    try:
        usuario = cadastrar_conta(db, payload)
    except CadastroDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None
    return LoginResponse(
        access_token=issue_access_token(usuario.id),
        expires_in=settings.jwt_exp_minutes * 60,
        usuario=get_user_view(db, usuario),
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


@router.post("/perfil", response_model=UsuarioPublico, status_code=status.HTTP_201_CREATED)
def concluir_cadastro(payload: PerfilPayload, usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    if usuario.papel_sistema == "ADMINISTRADOR":
        raise HTTPException(403, "A conta administrativa não possui perfil de participante.")
    try:
        usuario = completar_perfil(db, usuario, payload)
    except CadastroDuplicado as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    return get_user_view(db, usuario)
