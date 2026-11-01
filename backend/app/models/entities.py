import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Uuid, func
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
