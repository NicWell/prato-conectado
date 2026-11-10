from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import CredencialLocal, DoadorPessoaFisica, Organizacao, Usuario
from app.schemas.cadastro import CadastroPayload


class CadastroDuplicado(Exception):
    pass


def cadastrar_conta(db: Session, dados: CadastroPayload) -> Usuario:
    """A sessão da requisição é dedicada ao cadastro; qualquer conflito desfaz tudo."""
    try:
        if db.scalar(select(Usuario.id).where(func.lower(Usuario.email) == str(dados.email))):
            raise CadastroDuplicado("E-mail já cadastrado.")
        modelo = DoadorPessoaFisica if dados.perfil == "PESSOA_FISICA" else Organizacao
        documento = modelo.cpf if modelo is DoadorPessoaFisica else modelo.cnpj
        if db.scalar(select(modelo.id).where(documento == (dados.cpf or dados.cnpj))):
            raise CadastroDuplicado("Documento já cadastrado.")
        usuario = Usuario(nome=dados.responsavel, email=str(dados.email), papel_sistema="USUARIO", ativo=True)
        db.add(usuario)
        db.flush()
        db.add(CredencialLocal(usuario_id=usuario.id, senha_hash=hash_password(dados.senha)))
        campos = dados.model_dump(include={
            "nome", "email_contato", "telefone", "logradouro", "numero", "complemento",
            "bairro", "cidade", "uf", "cep",
        })
        if modelo is DoadorPessoaFisica:
            campos["cpf"] = dados.cpf
        else:
            campos.update(cnpj=dados.cnpj, tipo=dados.tipo, capacidade_atendimento=dados.capacidade_atendimento)
        db.add(modelo(usuario_responsavel_id=usuario.id, status_verificacao="PENDENTE", **campos))
        db.commit()
        return usuario
    except CadastroDuplicado:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        # A constraint também protege contra duas requisições concorrentes.
        if getattr(exc.orig, "sqlstate", None) == "23505" or "UNIQUE constraint failed" in str(exc.orig):
            raise CadastroDuplicado("E-mail ou documento já cadastrado.") from None
        raise
    except Exception:
        db.rollback()
        raise
