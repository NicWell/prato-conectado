"""Dados estritamente demonstrativos; não usados em produção."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import hash_password
from app.models import CredencialLocal, Organizacao, Usuario


_DEMOS = [
    ("doador@demo.com", "Carlos Silva", "Padaria Conectada", "DOADOR", "00000000000000"),
    ("ong@demo.com", "Maria Oliveira", "ONG Mãos Solidárias", "ONG", "00000000000001"),
]


def seed_demo_accounts(db: Session) -> None:
    if not settings.seed_demo_users:
        return
    if len(settings.demo_password) < 8:
        raise RuntimeError("DEMO_PASSWORD deve ter pelo menos 8 caracteres no modo demonstrativo.")
    for email, pessoa, org_nome, tipo, cnpj in _DEMOS:
        user = db.scalar(select(Usuario).where(func.lower(Usuario.email) == email))
        if user is None:
            user = Usuario(nome=pessoa, email=email, papel_sistema="USUARIO", ativo=True)
            db.add(user)
            db.flush()
        if db.get(CredencialLocal, user.id) is None:
            db.add(CredencialLocal(usuario_id=user.id, senha_hash=hash_password(settings.demo_password)))
        org = db.scalar(select(Organizacao).where(Organizacao.usuario_responsavel_id == user.id))
        if org is None:
            db.add(Organizacao(
                usuario_responsavel_id=user.id, tipo=tipo, nome=org_nome,
                cnpj=cnpj, email_contato=email, telefone="(82) 99999-0000",
                logradouro="Rua Exemplo", numero="100", bairro="Centro",
                cidade="Arapiraca", uf="AL", cep="57000000",
                capacidade_atendimento=100 if tipo == "ONG" else None,
                status_verificacao="APROVADA",
            ))
    db.commit()
