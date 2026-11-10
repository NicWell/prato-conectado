import uuid
from datetime import datetime
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    papel_sistema: Mapped[str] = mapped_column(String(20), nullable=False, default="USUARIO")
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    credencial: Mapped["CredencialLocal | None"] = relationship(back_populates="usuario", uselist=False)
    __table_args__ = (Index("uq_usuarios_email_ci", func.lower(email), unique=True),)


class CredencialLocal(Base):
    __tablename__ = "credenciais_locais"
    usuario_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    usuario: Mapped[Usuario] = relationship(back_populates="credencial")


class Organizacao(Base):
    __tablename__ = "organizacoes"
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_responsavel_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(12), nullable=False)
    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    cnpj: Mapped[str] = mapped_column(String(14), nullable=False, unique=True)
    email_contato: Mapped[str] = mapped_column(String(255), nullable=False)
    telefone: Mapped[str] = mapped_column(String(25), nullable=False)
    logradouro: Mapped[str] = mapped_column(String(180), nullable=False)
    numero: Mapped[str] = mapped_column(String(15), nullable=False)
    complemento: Mapped[str | None] = mapped_column(String(120))
    bairro: Mapped[str] = mapped_column(String(100), nullable=False)
    cidade: Mapped[str] = mapped_column(String(120), nullable=False)
    uf: Mapped[str] = mapped_column(String(2), nullable=False)
    cep: Mapped[str] = mapped_column(String(8), nullable=False)
    capacidade_atendimento: Mapped[int | None] = mapped_column(Integer)
    status_verificacao: Mapped[str] = mapped_column(String(12), nullable=False, default="PENDENTE")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DoadorPessoaFisica(Base):
    __tablename__ = "doadores_pessoa_fisica"
    __table_args__ = (
        CheckConstraint("status_verificacao IN ('PENDENTE', 'APROVADA', 'REPROVADA')", name="chk_doador_pf_status"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_responsavel_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, unique=True)
    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    cpf: Mapped[str] = mapped_column(String(11), nullable=False, unique=True)
    email_contato: Mapped[str] = mapped_column(String(255), nullable=False)
    telefone: Mapped[str] = mapped_column(String(25), nullable=False)
    logradouro: Mapped[str] = mapped_column(String(180), nullable=False)
    numero: Mapped[str] = mapped_column(String(15), nullable=False)
    complemento: Mapped[str | None] = mapped_column(String(120))
    bairro: Mapped[str] = mapped_column(String(100), nullable=False)
    cidade: Mapped[str] = mapped_column(String(120), nullable=False)
    uf: Mapped[str] = mapped_column(String(2), nullable=False)
    cep: Mapped[str] = mapped_column(String(8), nullable=False)
    status_verificacao: Mapped[str] = mapped_column(String(12), nullable=False, default="PENDENTE")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DesafioGoogle(Base):
    __tablename__ = "desafios_google"
    __table_args__ = (
        CheckConstraint("finalidade IN ('LOGIN', 'VINCULAR')", name="chk_desafio_google_finalidade"),
        CheckConstraint("(finalidade = 'LOGIN' AND usuario_id IS NULL) OR (finalidade = 'VINCULAR' AND usuario_id IS NOT NULL)", name="chk_desafio_google_usuario"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nonce_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    finalidade: Mapped[str] = mapped_column(String(10), nullable=False)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey("usuarios.id"))
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    consumido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
