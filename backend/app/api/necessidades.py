from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth import current_user, get_user_view
from app.db.session import get_db
from app.models import Usuario
from app.schemas.necessidades import NecessidadeOng
from app.services import necessidades
from app.services.doacoes import perfil_operacional

router = APIRouter(prefix="/api/necessidades", tags=["Necessidades da ONG"])


def ong_aprovada(usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    return perfil_operacional(db, usuario, get_user_view(db, usuario), ("ONG",))


@router.get("")
def listar(ong=Depends(ong_aprovada), db: Session = Depends(get_db)):
    return necessidades.listar(db, ong)


@router.post("", status_code=201)
def criar(dados: NecessidadeOng, ong=Depends(ong_aprovada), db: Session = Depends(get_db)):
    return necessidades.criar(db, ong, dados)


@router.put("/{necessidade_id}")
def editar(necessidade_id: UUID, dados: NecessidadeOng, ong=Depends(ong_aprovada),
           db: Session = Depends(get_db)):
    return necessidades.editar(db, ong, necessidade_id, dados)


@router.post("/{necessidade_id}/desativacao")
def desativar(necessidade_id: UUID, ong=Depends(ong_aprovada), db: Session = Depends(get_db)):
    return necessidades.desativar(db, ong, necessidade_id)
