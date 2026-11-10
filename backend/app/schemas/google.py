from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GooglePayload(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    desafio_id: UUID
    id_token: str = Field(min_length=1, max_length=16384)


class VincularGooglePayload(GooglePayload):
    senha_atual: str = Field(min_length=1, max_length=256)


class DesafioGoogleResponse(BaseModel):
    desafio_id: UUID
    nonce: str
    expires_in: int = 300
