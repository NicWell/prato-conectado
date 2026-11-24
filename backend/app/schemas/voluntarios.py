from pydantic import EmailStr, Field

from app.schemas.cadastro import EnderecoContato, Texto


class VoluntarioPayload(EnderecoContato):
    nome: Texto = Field(max_length=160)
    email: EmailStr | None = Field(default=None, max_length=255)
