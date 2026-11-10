"""Somente tokens OIDC assinados pelo Google; sem modo simulado em runtime."""
from dataclasses import dataclass
import hashlib
import hmac

from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from pydantic import EmailStr, TypeAdapter, ValidationError
import requests

from app.core.config import settings


class FalhaGoogle(Exception):
    def __init__(self, status: int, codigo: str, mensagem: str):
        self.status = status
        self.detail = {"codigo": codigo, "mensagem": mensagem}
        super().__init__(mensagem)


@dataclass(frozen=True)
class IdentidadeGoogle:
    sub: str
    email: str
    nome: str


def exigir_google_configurado():
    if not settings.google_client_id:
        raise FalhaGoogle(503, "GOOGLE_NAO_CONFIGURADO", "Login Google ainda não configurado.")


def verificar_token_google(token: str, nonce_hash: str) -> IdentidadeGoogle:
    exigir_google_configurado()
    try:
        with requests.Session() as session:
            transporte = GoogleRequest(session=session)

            def request_limitado(url, **kwargs):
                kwargs["timeout"] = 5
                return transporte(url=url, **kwargs)

            claims = id_token.verify_oauth2_token(token, request_limitado, audience=settings.google_client_id)
        # A biblioteca verifica assinatura, aud, iat, exp e iss. Regras adicionais
        # abaixo exigem e-mail verificado, subject e nonce desta tentativa.
        sub = claims.get("sub")
        nonce = claims.get("nonce")
        if not isinstance(sub, str) or not 1 <= len(sub) <= 255:
            raise ValueError("Subject ausente")
        if claims.get("email_verified") is not True:
            raise ValueError("E-mail não verificado")
        if claims.get("azp", settings.google_client_id) != settings.google_client_id:
            raise ValueError("Authorized party inválida")
        if not isinstance(nonce, str) or not hmac.compare_digest(hashlib.sha256(nonce.encode()).hexdigest(), nonce_hash):
            raise ValueError("Nonce inválido")
        email = str(TypeAdapter(EmailStr).validate_python(claims.get("email"))).lower()
        if len(email) > 255:
            raise ValueError("E-mail longo")
        nome = claims.get("name")
        nome = nome.strip() if isinstance(nome, str) else ""
        return IdentidadeGoogle(sub=sub, email=email, nome=(nome or email.split("@")[0])[:160])
    except (TransportError, requests.RequestException):
        raise FalhaGoogle(503, "GOOGLE_INDISPONIVEL", "Não foi possível validar a identidade Google. Tente novamente.") from None
    except (ValueError, GoogleAuthError, ValidationError):
        raise FalhaGoogle(401, "TOKEN_GOOGLE_INVALIDO", "Identidade Google inválida ou expirada.") from None
