from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import LoginResponse, current_user, get_user_view
from app.core.config import settings
from app.core.google_auth import FalhaGoogle
from app.core.security import issue_access_token
from app.db.session import get_db
from app.models import Usuario
from app.schemas.google import DesafioGoogleResponse, GooglePayload, VincularGooglePayload
from app.services.google import autenticar_google, criar_desafio

router = APIRouter(prefix="/api/auth/google", tags=["Autenticação Google"])


def sessao_google(db, usuario):
    return LoginResponse(access_token=issue_access_token(usuario.id),
                         expires_in=settings.jwt_exp_minutes * 60,
                         usuario=get_user_view(db, usuario))


def desafio(db, usuario=None):
    try:
        desafio_id, nonce = criar_desafio(db, usuario)
    except FalhaGoogle as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from None
    return DesafioGoogleResponse(desafio_id=desafio_id, nonce=nonce)


@router.post("/desafio", response_model=DesafioGoogleResponse, status_code=201)
def desafio_login(db: Session = Depends(get_db)):
    return desafio(db)


@router.post("/vincular/desafio", response_model=DesafioGoogleResponse, status_code=201)
def desafio_vinculacao(usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    return desafio(db, usuario)


@router.post("", response_model=LoginResponse)
def entrar_google(payload: GooglePayload, db: Session = Depends(get_db)):
    try:
        usuario = autenticar_google(db, payload.desafio_id, payload.id_token)
    except FalhaGoogle as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from None
    return sessao_google(db, usuario)


@router.post("/vincular", response_model=LoginResponse)
def vincular_google(payload: VincularGooglePayload, usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    try:
        usuario = autenticar_google(db, payload.desafio_id, payload.id_token, usuario, payload.senha_atual)
    except FalhaGoogle as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from None
    return sessao_google(db, usuario)
