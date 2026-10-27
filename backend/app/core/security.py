from datetime import datetime, timedelta, timezone
from uuid import UUID
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from app.core.config import settings

hasher = PasswordHasher()
ISSUER = "prato-conectado-api"
AUDIENCE = "prato-conectado-frontend"


def hash_password(senha: str) -> str:
    return hasher.hash(senha)


def verify_password(senha: str, senha_hash: str) -> bool:
    try:
        return hasher.verify(senha_hash, senha)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def issue_access_token(usuario_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(usuario_id), "iss": ISSUER, "aud": AUDIENCE,
        "iat": now, "exp": now + timedelta(minutes=settings.jwt_exp_minutes),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def read_access_token(token: str) -> UUID:
    decoded = jwt.decode(
        token, settings.jwt_secret_key,
        algorithms=["HS256"], issuer=ISSUER, audience=AUDIENCE,
        options={"require": ["sub", "iat", "exp", "iss", "aud"]},
    )
    if decoded.get("type") != "access":
        raise jwt.InvalidTokenError("Tipo de token inválido")
    try:
        return UUID(decoded["sub"])
    except (ValueError, TypeError) as exc:
        raise jwt.InvalidTokenError("Subject inválido") from exc
