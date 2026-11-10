import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator, model_validator

from app.core.documentos import normalizar_cnpj, normalizar_cpf

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
UFS = set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split())


class CadastroPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    tipo: Literal["ONG", "DOADOR"]
    perfil: Literal["ONG", "EMPRESA", "PESSOA_FISICA"]
    nome: Texto = Field(max_length=180)
    responsavel: Texto = Field(max_length=160)
    email: EmailStr = Field(max_length=255)
    senha: str = Field(min_length=8, max_length=256)
    cnpj: str | None = Field(default=None, max_length=18)
    cpf: str | None = Field(default=None, max_length=14)
    email_contato: EmailStr = Field(max_length=255)
    telefone: str = Field(max_length=25)
    logradouro: Texto = Field(max_length=180)
    numero: Texto = Field(max_length=15)
    complemento: Texto | None = Field(default=None, max_length=120)
    bairro: Texto = Field(max_length=100)
    cidade: Texto = Field(max_length=120)
    uf: str = Field(min_length=2, max_length=2)
    cep: str = Field(max_length=9)
    capacidade_atendimento: int | None = Field(default=None, gt=0, le=2147483647, strict=True)

    @field_validator("email", "email_contato", mode="before")
    @classmethod
    def normalizar_email(cls, valor):
        return valor.strip().lower() if isinstance(valor, str) else valor

    @field_validator("cnpj")
    @classmethod
    def validar_cnpj(cls, valor):
        return normalizar_cnpj(valor) if valor is not None else None

    @field_validator("cpf")
    @classmethod
    def validar_cpf(cls, valor):
        return normalizar_cpf(valor) if valor is not None else None

    @field_validator("senha")
    @classmethod
    def validar_senha(cls, valor):
        if not valor.strip():
            raise ValueError("A senha não pode conter somente espaços.")
        return valor  # Senhas nunca são normalizadas ou truncadas.

    @field_validator("uf")
    @classmethod
    def validar_uf(cls, valor):
        valor = valor.upper()
        if valor not in UFS:
            raise ValueError("UF inválida.")
        return valor

    @field_validator("cep")
    @classmethod
    def validar_cep(cls, valor):
        if not re.fullmatch(r"[0-9]{5}-?[0-9]{3}", valor):
            raise ValueError("CEP deve ter 8 dígitos, com ou sem hífen.")
        return valor.replace("-", "")

    @field_validator("telefone")
    @classmethod
    def validar_telefone(cls, valor):
        if not re.fullmatch(r"[0-9()+ .-]+", valor):
            raise ValueError("Telefone inválido.")
        numero = re.sub(r"[^0-9]", "", valor)
        if numero.startswith("55") and len(numero) in (12, 13):
            numero = numero[2:]
        if not re.fullmatch(r"[1-9][0-9]{9,10}", numero):
            raise ValueError("Informe telefone brasileiro com DDD.")
        return numero

    @model_validator(mode="after")
    def validar_perfil(self):
        if self.tipo == "ONG":
            if self.perfil != "ONG" or self.cnpj is None or self.cpf is not None:
                raise ValueError("ONG exige perfil ONG e CNPJ, sem CPF.")
            if self.capacidade_atendimento is None:
                raise ValueError("ONG exige capacidade_atendimento positiva.")
        else:
            if self.perfil == "EMPRESA":
                if self.cnpj is None or self.cpf is not None:
                    raise ValueError("Empresa exige CNPJ, sem CPF.")
            elif self.perfil == "PESSOA_FISICA":
                if self.cpf is None or self.cnpj is not None:
                    raise ValueError("Pessoa física exige CPF, sem CNPJ.")
            else:
                raise ValueError("Doador deve ter perfil EMPRESA ou PESSOA_FISICA.")
            if self.capacidade_atendimento is not None:
                raise ValueError("capacidade_atendimento é exclusiva de ONG.")
        return self
