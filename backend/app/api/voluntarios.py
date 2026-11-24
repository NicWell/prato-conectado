from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.necessidades import ong_aprovada
from app.db.session import get_db
from app.schemas.voluntarios import VoluntarioPayload
from app.services import voluntarios

router = APIRouter(prefix="/api/voluntarios", tags=["Voluntários"])


@router.get("")
def listar(ong=Depends(ong_aprovada), db: Session = Depends(get_db)):
    return voluntarios.listar(db, ong)


@router.post("", status_code=201)
def cadastrar(dados: VoluntarioPayload, ong=Depends(ong_aprovada), db: Session = Depends(get_db)):
    return voluntarios.cadastrar(db, ong, dados)
