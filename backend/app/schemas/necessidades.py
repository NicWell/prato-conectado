from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.schemas.doacoes import QuantidadeAlimento, UnidadeAlimento


class NecessidadeOng(BaseModel):
    model_config = ConfigDict(extra="forbid")

    categoria: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    quantidade: QuantidadeAlimento
    unidade: UnidadeAlimento
    observacao: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
