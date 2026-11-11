from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import current_user
from app.db.session import get_db
from app.models import Usuario
from app.schemas.admin import CadastroDetalhe, DecisaoPayload, ListaCadastros, Perfil, StatusCadastro
from app.services.admin import decidir_cadastro, detalhar_cadastro, listar_cadastros


def administrador_atual(usuario: Usuario = Depends(current_user)):
    # Papel consultado no banco em cada chamada; não confia no frontend/JWT.
    if usuario.papel_sistema != "ADMINISTRADOR":
        raise HTTPException(403, "Acesso restrito à administração.")
    return usuario


router = APIRouter(prefix="/api/admin", tags=["Administração"], dependencies=[Depends(administrador_atual)])


@router.get("/cadastros", response_model=ListaCadastros)
def listar(status: StatusCadastro | None = "PENDENTE", perfil: Perfil | None = None,
           busca: str = Query(default="", max_length=180), pagina: int = Query(default=1, ge=1),
           tamanho: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)):
    return listar_cadastros(db, status, perfil, busca.strip(), pagina, tamanho)


@router.get("/cadastros/{perfil}/{cadastro_id}", response_model=CadastroDetalhe)
def detalhes(perfil: Perfil, cadastro_id: UUID, db: Session = Depends(get_db)):
    return detalhar_cadastro(db, perfil, cadastro_id)


@router.post("/cadastros/{perfil}/{cadastro_id}/decisao", response_model=CadastroDetalhe)
def decidir(perfil: Perfil, cadastro_id: UUID, payload: DecisaoPayload,
            administrador: Usuario = Depends(administrador_atual), db: Session = Depends(get_db)):
    return decidir_cadastro(db, administrador, perfil, cadastro_id, payload)
