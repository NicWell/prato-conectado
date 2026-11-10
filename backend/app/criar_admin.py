"""Provisionamento interno: python -m app.criar_admin (nunca via HTTP)."""
from getpass import getpass

from pydantic import BaseModel, EmailStr, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import CredencialLocal, Usuario


class DadosAdministrador(BaseModel):
    nome: str = Field(min_length=1, max_length=160)
    email: EmailStr = Field(max_length=255)
    senha: str = Field(min_length=8, max_length=256, repr=False)


def criar_administrador(db, dados):
    """Cria conta exclusiva, sem promover contas públicas nem alterar senhas."""
    try:
        if db.scalar(select(Usuario.id).where(Usuario.papel_sistema == "ADMINISTRADOR")):
            raise ValueError("A conta administrativa já existe. Nenhuma alteração realizada.")
        usuario = Usuario(nome=dados.nome, email=str(dados.email).lower(), papel_sistema="ADMINISTRADOR", ativo=True)
        db.add(usuario)
        db.flush()
        db.add(CredencialLocal(usuario_id=usuario.id, senha_hash=hash_password(dados.senha)))
        db.commit()
        return usuario
    except Exception:
        db.rollback()
        raise


def main():
    nome = input("Nome da equipe administradora: ").strip()
    email = input("E-mail administrativo: ").strip().lower()
    senha = getpass("Senha (mínimo 8 caracteres): ")
    if senha != getpass("Confirme a senha: "):
        raise SystemExit("As senhas não coincidem.")
    try:
        dados = DadosAdministrador(nome=nome, email=email, senha=senha)
    except ValidationError:
        raise SystemExit("Nome, e-mail ou senha inválidos. Nenhuma conta foi criada.") from None
    try:
        with SessionLocal() as db:
            criar_administrador(db, dados)
    except ValueError as exc:
        raise SystemExit(str(exc)) from None
    except IntegrityError:
        raise SystemExit("E-mail já utilizado ou conta administrativa já existente. Nenhuma alteração realizada.") from None
    print("Conta administrativa criada. Use o login normal da aplicação.")


if __name__ == "__main__":
    main()
