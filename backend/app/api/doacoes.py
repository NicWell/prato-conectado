from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth import current_user, get_user_view
from app.db.session import get_db
from app.models import Usuario
from app.schemas.doacoes import PublicacaoDoacao, RecebimentoDoacao
from app.services import doacoes

router = APIRouter(prefix="/api/doacoes", tags=["Doações"])


@router.get("/catalogo")
def catalogo(usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    doacoes.perfil_operacional(db, usuario, get_user_view(db, usuario), ("DOADOR",))
    return doacoes.catalogo(db)


@router.get("")
def listar(usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    perfil = get_user_view(db, usuario)
    cadastro = doacoes.perfil_operacional(db, usuario, perfil, ("DOADOR", "ONG"))
    return doacoes.listar(db, cadastro, perfil.tipo)


@router.post("", status_code=201)
def publicar(dados: PublicacaoDoacao, usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    cadastro = doacoes.perfil_operacional(db, usuario, get_user_view(db, usuario), ("DOADOR",))
    return doacoes.publicar(db, cadastro, usuario, dados)


@router.post("/{doacao_id}/reserva")
def reservar(doacao_id: UUID, usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    ong = doacoes.perfil_operacional(db, usuario, get_user_view(db, usuario), ("ONG",))
    return doacoes.reservar(db, ong, usuario, doacao_id)


@router.post("/{doacao_id}/cancelamento")
def cancelar(doacao_id: UUID, usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    cadastro = doacoes.perfil_operacional(db, usuario, get_user_view(db, usuario), ("DOADOR",))
    return doacoes.transicionar(db, cadastro, usuario, doacao_id, "CANCELADA")


@router.post("/{doacao_id}/retirada")
def retirar(doacao_id: UUID, usuario: Usuario = Depends(current_user), db: Session = Depends(get_db)):
    ong = doacoes.perfil_operacional(db, usuario, get_user_view(db, usuario), ("ONG",))
    return doacoes.transicionar(db, ong, usuario, doacao_id, "RETIRADA")


@router.post("/{doacao_id}/recebimento")
def receber(doacao_id: UUID, checklist: RecebimentoDoacao, usuario: Usuario = Depends(current_user),
            db: Session = Depends(get_db)):
    ong = doacoes.perfil_operacional(db, usuario, get_user_view(db, usuario), ("ONG",))
    return doacoes.transicionar(db, ong, usuario, doacao_id, "ENTREGUE", checklist)
