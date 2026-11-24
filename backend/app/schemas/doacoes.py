from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated


UnidadeAlimento = Literal["porções", "kg", "unidades", "litros", "caixas"]
QuantidadeAlimento = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=3)]


class ChecklistDoador(BaseModel):
    model_config = ConfigDict(extra="forbid")

    temperatura: Literal[True]
    embalagem: Literal[True]
    validade: Literal[True]
    conservacao: Literal[True]
    termo: Literal[True]


class PublicacaoDoacao(BaseModel):
    model_config = ConfigDict(extra="forbid")

    categoria: str = Field(min_length=1, max_length=100)
    descricao: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    quantidade: QuantidadeAlimento
    unidade: UnidadeAlimento
    modalidade: Literal["RETIRADA", "ENTREGA"]
    validade_em: AwareDatetime
    inicio_retirada: AwareDatetime
    fim_retirada: AwareDatetime
    termo_id: UUID
    checklist: ChecklistDoador

class ChecklistOng(BaseModel):
    model_config = ConfigDict(extra="forbid")

    temperatura: Literal[True]
    embalagem: Literal[True]
    validade: Literal[True]
    conservacao: Literal[True]


class RecebimentoDoacao(ChecklistOng):
    voluntario_id: UUID | None = None
