from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.google_auth import FalhaGoogle, exigir_google_configurado, verificar_token_google
from app.core.security import verify_password
from app.models import CredencialLocal, DesafioGoogle, Usuario


def criar_desafio(db: Session, usuario: Usuario | None = None) -> tuple[UUID, str]:
    exigir_google_configurado()
    nonce = secrets.token_urlsafe(32)
    desafio = DesafioGoogle(
        nonce_hash=hashlib.sha256(nonce.encode()).hexdigest(),
        finalidade="VINCULAR" if usuario else "LOGIN",
        usuario_id=usuario.id if usuario else None,
        expira_em=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(desafio)
    db.commit()
    return desafio.id, nonce


def autenticar_google(db: Session, desafio_id: UUID, token: str,
                      usuario: Usuario | None = None, senha_atual: str | None = None) -> Usuario:
    """Validação externa e alterações locais são separadas; consumo é atômico."""
    exigir_google_configurado()
    try:
        finalidade = "VINCULAR" if usuario else "LOGIN"
        usuario_id = usuario.id if usuario else None
        agora = datetime.now(timezone.utc)
        desafio = db.scalar(select(DesafioGoogle).where(
            DesafioGoogle.id == desafio_id, DesafioGoogle.finalidade == finalidade,
            DesafioGoogle.usuario_id == usuario_id, DesafioGoogle.consumido_em.is_(None),
            DesafioGoogle.expira_em > agora,
        ))
        if desafio is None:
            raise FalhaGoogle(401, "DESAFIO_INVALIDO", "Solicite um novo desafio Google.")
        identidade = verificar_token_google(token, desafio.nonce_hash)
        # UPDATE condicional protege também quando duas requisições passam pelo SELECT.
        consumido = db.execute(update(DesafioGoogle).where(
            DesafioGoogle.id == desafio_id, DesafioGoogle.consumido_em.is_(None),
            DesafioGoogle.expira_em > datetime.now(timezone.utc),
        ).values(consumido_em=datetime.now(timezone.utc)).execution_options(synchronize_session=False))
        if consumido.rowcount != 1:
            raise FalhaGoogle(401, "DESAFIO_INVALIDO", "Solicite um novo desafio Google.")

        if usuario is not None:
            usuario = db.scalar(select(Usuario).where(Usuario.id == usuario_id).with_for_update().execution_options(populate_existing=True))
            if usuario is None or not usuario.ativo:
                raise FalhaGoogle(401, "CONTA_INDISPONIVEL", "Conta indisponível.")
            credencial = db.get(CredencialLocal, usuario.id)
            if not credencial or not verify_password(senha_atual or "", credencial.senha_hash):
                raise FalhaGoogle(401, "SENHA_INVALIDA", "Confirme a senha atual da conta local.")
            if identidade.email != usuario.email.lower():
                raise FalhaGoogle(409, "EMAIL_GOOGLE_DIFERENTE", "Use a conta Google com o mesmo e-mail da conta local.")
            if usuario.google_sub and usuario.google_sub != identidade.sub:
                raise FalhaGoogle(409, "GOOGLE_JA_VINCULADO", "A conta já possui outra identidade Google vinculada.")
            outro = db.scalar(select(Usuario.id).where(Usuario.google_sub == identidade.sub, Usuario.id != usuario.id))
            if outro:
                raise FalhaGoogle(409, "GOOGLE_JA_VINCULADO", "Identidade Google já vinculada a outra conta.")
            usuario.google_sub = identidade.sub
        else:
            usuario = db.scalar(select(Usuario).where(Usuario.google_sub == identidade.sub))
            if usuario is None:
                existente = db.scalar(select(Usuario.id).where(func.lower(Usuario.email) == identidade.email))
                if existente:
                    raise FalhaGoogle(409, "VINCULACAO_NECESSARIA", "Entre pelo método existente e vincule sua conta Google.")
                usuario = Usuario(google_sub=identidade.sub, email=identidade.email,
                                  nome=identidade.nome, ativo=True, papel_sistema="USUARIO")
                db.add(usuario)
            elif not usuario.ativo:
                raise FalhaGoogle(401, "CONTA_INDISPONIVEL", "Conta indisponível.")
            # sub é a identidade estável; mudanças de e-mail no Google não
            # atualizam automaticamente a conta local nem seu cadastro.
        db.commit()
        return usuario
    except IntegrityError as exc:
        db.rollback()
        if getattr(exc.orig, "sqlstate", None) == "23505" or "UNIQUE constraint failed" in str(exc.orig):
            raise FalhaGoogle(409, "CONFLITO_DE_CONTA", "Conta modificada por outra requisição. Tente novamente.") from None
        raise
    except Exception:
        db.rollback()
        raise
