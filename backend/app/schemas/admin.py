from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Perfil = Literal["ONG", "EMPRESA", "PESSOA_FISICA"]
StatusCadastro = Literal["PENDENTE", "APROVADA", "REPROVADA"]


class DecisaoPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    decisao: Literal["APROVADA", "REPROVADA"]
    justificativa: str | None = Field(default=None, max_length=2000)

    @field_validator("justificativa")
    @classmethod
    def limpar_justificativa(cls, valor):
        return valor.strip() or None if valor is not None else None

    @model_validator(mode="after")
    def exigir_motivo(self):
        if self.decisao == "REPROVADA" and not self.justificativa:
            raise ValueError("Informe a justificativa da reprovação.")
        return self


class CadastroResumo(BaseModel):
    id: UUID
    perfil: Perfil
    nome: str
    responsavel: str
    email: str
    cidade: str
    uf: str
    status: StatusCadastro
    criado_em: datetime


class ListaCadastros(BaseModel):
    itens: list[CadastroResumo]
    total: int
    pagina: int
    tamanho: int


class AnalisePublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    administrador_id: UUID
    decisao: str
    justificativa: str | None
    analisado_em: datetime


class CadastroDetalhe(CadastroResumo):
    usuario_id: UUID
    documento: str
    email_contato: str
    telefone: str
    logradouro: str
    numero: str
    complemento: str | None
    bairro: str
    cep: str
    capacidade_atendimento: int | None
    historico: list[AnalisePublica]
