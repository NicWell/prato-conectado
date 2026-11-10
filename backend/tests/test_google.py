from dataclasses import replace
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from uuid import UUID

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from google.auth import crypt, jwt as google_jwt
from google.auth.exceptions import TransportError
from sqlalchemy import func, select

from app.core import google_auth
from app.models import CredencialLocal, DesafioGoogle, Organizacao, Usuario
from test_auth import create_user
from test_cadastro import payload

CLIENT_ID = "teste.apps.googleusercontent.com"


@pytest.fixture(scope="module")
def chaves():
    privada = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    nome = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Google test certificate")])
    agora = datetime.now(timezone.utc)
    certificado = (x509.CertificateBuilder().subject_name(nome).issuer_name(nome)
                   .public_key(privada.public_key()).serial_number(x509.random_serial_number())
                   .not_valid_before(agora - timedelta(days=1)).not_valid_after(agora + timedelta(days=1))
                   .sign(privada, hashes.SHA256()))
    pem = privada.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    return pem, certificado.public_bytes(serialization.Encoding.PEM).decode()


@pytest.fixture
def google(monkeypatch, chaves):
    monkeypatch.setattr(google_auth, "settings", replace(google_auth.settings, google_client_id=CLIENT_ID))
    privada, certificado = chaves

    class Response:
        status = 200
        data = json.dumps({"chave-teste": certificado}).encode()

    def request(**kwargs):
        assert kwargs["url"].startswith("https://www.googleapis.com/")
        assert kwargs["timeout"] == 5
        return Response()

    # Substitui somente o download das chaves; assinatura e claims são validados de verdade.
    monkeypatch.setattr(google_auth, "GoogleRequest", lambda **kwargs: request)

    def token(nonce_tentativa, **alteracoes):
        agora = int(datetime.now(timezone.utc).timestamp())
        claims = dict(iss="https://accounts.google.com", aud=CLIENT_ID, sub="google-123",
                      iat=agora - 1, exp=agora + 300, email="maria@example.org",
                      email_verified=True, name="Maria Google", nonce=nonce_tentativa)
        claims.update(alteracoes)
        claims = {k: v for k, v in claims.items() if v is not None}
        signer = crypt.RSASigner.from_string(privada, key_id="chave-teste")
        return google_jwt.encode(signer, claims).decode()

    return token


def desafio(client, local_token=None):
    path = "/api/auth/google/vincular/desafio" if local_token else "/api/auth/google/desafio"
    headers = {"Authorization": f"Bearer {local_token}"} if local_token else {}
    resposta = client.post(path, headers=headers)
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def entrar(client, google, **claims):
    tentativa = desafio(client)
    return client.post("/api/auth/google", json={"desafio_id": tentativa["desafio_id"],
                                                "id_token": google(tentativa["nonce"], **claims)})


def test_google_desabilitado(client, db):
    resposta = client.post("/api/auth/google/desafio")
    assert resposta.status_code == 503
    assert resposta.json()["detail"]["codigo"] == "GOOGLE_NAO_CONFIGURADO"
    assert db.scalar(select(func.count()).select_from(DesafioGoogle)) == 0


def test_primeiro_login_retorno_e_subject_estavel(client, db, google):
    resposta = entrar(client, google)
    assert resposta.status_code == 200, resposta.text
    usuario = resposta.json()["usuario"]
    assert usuario["google_vinculado"] is True
    assert usuario["cadastro_completo"] is False
    assert usuario["tipo"] == "SEM_ORGANIZACAO"
    assert usuario["status"] == "PENDENTE"
    assert usuario["papel_sistema"] == "USUARIO"
    assert db.scalar(select(func.count()).select_from(CredencialLocal)) == 0
    assert entrar(client, google).json()["usuario"]["usuario_id"] == usuario["usuario_id"]
    # Mudar e-mail no provedor não cria outra conta ou altera contato local.
    retorno = entrar(client, google, email="outro@example.org")
    assert retorno.status_code == 200
    assert retorno.json()["usuario"]["email"] == "maria@example.org"
    assert db.scalar(select(func.count()).select_from(Usuario)) == 1
    assert client.post("/api/auth/login", json={"email": usuario["email"], "senha": "qualquer"}).status_code == 401


@pytest.mark.parametrize("alteracoes", [
    {"aud": "outro.apps.googleusercontent.com"}, {"iss": "https://atacante.example"},
    {"exp": 1}, {"iat": 9999999999}, {"nonce": "outra-tentativa"}, {"nonce": None},
    {"sub": None}, {"sub": ""}, {"sub": "x" * 256},
    {"email_verified": False}, {"email_verified": "true"}, {"email_verified": None},
    {"email": "invalido"}, {"email": None}, {"azp": "outro.apps.googleusercontent.com"},
])
def test_token_invalido_nao_cria_conta(client, db, google, alteracoes):
    resposta = entrar(client, google, **alteracoes)
    assert resposta.status_code == 401, resposta.text
    assert db.scalar(select(func.count()).select_from(Usuario)) == 0


def test_assinatura_invalida_e_sem_exposicao(client, db, google):
    tentativa = desafio(client)
    token = google(tentativa["nonce"])
    partes = token.split(".")
    partes[2] = ("A" if partes[2][0] != "A" else "B") + partes[2][1:]
    adulterado = ".".join(partes)
    resposta = client.post("/api/auth/google", json={"desafio_id": tentativa["desafio_id"], "id_token": adulterado})
    assert resposta.status_code == 401
    assert adulterado not in resposta.text
    assert db.scalar(select(func.count()).select_from(Usuario)) == 0


def test_falha_de_rede_nao_autentica(client, db, google, monkeypatch):
    def request(**kwargs):
        raise TransportError("Sem rede")
    monkeypatch.setattr(google_auth, "GoogleRequest", lambda **kwargs: request)
    assert entrar(client, google).status_code == 503
    assert db.scalar(select(func.count()).select_from(Usuario)) == 0


def test_desafio_replay_expiracao_nonce_e_finalidade(client, db, google):
    tentativa = desafio(client)
    registro = db.get(DesafioGoogle, UUID(tentativa["desafio_id"]))
    assert registro.nonce_hash == hashlib.sha256(tentativa["nonce"].encode()).hexdigest()
    dados = {"desafio_id": tentativa["desafio_id"], "id_token": google(tentativa["nonce"])}
    assert client.post("/api/auth/google", json=dados).status_code == 200
    assert client.post("/api/auth/google", json=dados).status_code == 401
    expirado = desafio(client)
    registro = db.get(DesafioGoogle, UUID(expirado["desafio_id"]))
    registro.expira_em = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    assert client.post("/api/auth/google", json={"desafio_id": expirado["desafio_id"], "id_token": google(expirado["nonce"])}).status_code == 401
    outro = desafio(client)
    assert client.post("/api/auth/google", json={"desafio_id": outro["desafio_id"], "id_token": dados["id_token"]}).status_code == 401


def test_email_existente_nao_vincula_automaticamente(client, db, google):
    usuario = create_user(db, email="maria@example.org")
    resposta = entrar(client, google)
    assert resposta.status_code == 409
    assert resposta.json()["detail"]["codigo"] == "VINCULACAO_NECESSARIA"
    db.refresh(usuario)
    assert usuario.google_sub is None
    assert db.scalar(select(func.count()).select_from(Usuario)) == 1


def test_vincular_preserva_perfil_senha_e_status(client, db, google):
    usuario = create_user(db, email="maria@example.org")
    login = client.post("/api/auth/login", json={"email": usuario.email, "senha": "SenhaForte@123"}).json()
    token = login["access_token"]
    tentativa = desafio(client, token)
    dados = {"desafio_id": tentativa["desafio_id"], "id_token": google(tentativa["nonce"]), "senha_atual": "SenhaForte@123"}
    resposta = client.post("/api/auth/google/vincular", json=dados, headers={"Authorization": f"Bearer {token}"})
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["usuario"]["google_vinculado"] is True
    assert resposta.json()["usuario"]["status"] == "APROVADA"
    assert resposta.json()["usuario"]["id"] == login["usuario"]["id"]
    assert entrar(client, google).json()["usuario"]["usuario_id"] == str(usuario.id)
    assert client.post("/api/auth/login", json={"email": usuario.email, "senha": "SenhaForte@123"}).status_code == 200
    assert db.scalar(select(func.count()).select_from(Organizacao)) == 1


@pytest.mark.parametrize("caso", ["sem_sessao", "senha_errada", "email_diferente", "outro_subject", "desafio_login", "desafio_outra_conta"])
def test_vinculacao_recusa_casos_inseguros(client, db, google, caso):
    usuario = create_user(db, email="maria@example.org")
    token = client.post("/api/auth/login", json={"email": usuario.email, "senha": "SenhaForte@123"}).json()["access_token"]
    tentativa = desafio(client, token) if caso != "desafio_login" else desafio(client)
    if caso == "desafio_outra_conta":
        outro = Usuario(nome="Outra", email="outra@example.org", ativo=True)
        db.add(outro)
        db.flush()
        registro = db.get(DesafioGoogle, UUID(tentativa["desafio_id"]))
        registro.usuario_id = outro.id
        db.commit()
    if caso == "outro_subject":
        usuario.google_sub = "subject-anterior"
        db.commit()
    dados = {"desafio_id": tentativa["desafio_id"],
             "id_token": google(tentativa["nonce"], email="outro@example.org" if caso == "email_diferente" else usuario.email),
             "senha_atual": "errada" if caso == "senha_errada" else "SenhaForte@123"}
    headers = {} if caso == "sem_sessao" else {"Authorization": f"Bearer {token}"}
    resposta = client.post("/api/auth/google/vincular", json=dados, headers=headers)
    assert resposta.status_code == (409 if caso in ("email_diferente", "outro_subject") else 401), resposta.text
    db.refresh(usuario)
    assert usuario.google_sub == ("subject-anterior" if caso == "outro_subject" else None)


def test_conta_inativa_google_nao_entra(client, db, google):
    assert entrar(client, google).status_code == 200
    usuario = db.scalar(select(Usuario))
    usuario.ativo = False
    db.commit()
    assert entrar(client, google).status_code == 401


@pytest.mark.parametrize("perfil", ["ONG", "EMPRESA", "PESSOA_FISICA"])
def test_completar_cadastro_google(client, db, google, perfil):
    login = entrar(client, google).json()
    dados = payload(perfil)
    for campo in ("email", "senha", "responsavel"):
        dados.pop(campo)
    headers = {"Authorization": f"Bearer {login['access_token']}"}
    resposta = client.post("/api/auth/perfil", json=dados, headers=headers)
    assert resposta.status_code == 201, resposta.text
    assert resposta.json()["cadastro_completo"] is True
    assert resposta.json()["status"] == "PENDENTE"
    assert resposta.json()["perfil"] == perfil
    assert resposta.json()["responsavel"] == "Maria Google"
    assert client.post("/api/auth/perfil", json=dados, headers=headers).status_code == 409
    assert client.get("/api/auth/me", headers=headers).json() == resposta.json()
    assert entrar(client, google).json()["usuario"] == resposta.json()
    assert db.scalar(select(func.count()).select_from(CredencialLocal)) == 0


def test_perfil_exige_autenticacao_documento_e_sem_campos_de_conta(client, google):
    dados = payload()
    assert client.post("/api/auth/perfil", json={}).status_code == 401
    login = entrar(client, google).json()
    headers = {"Authorization": f"Bearer {login['access_token']}"}
    assert client.post("/api/auth/perfil", json=dados, headers=headers).status_code == 422
    for campo in ("email", "senha", "responsavel"):
        dados.pop(campo)
    dados["cnpj"] = None
    assert client.post("/api/auth/perfil", json=dados, headers=headers).status_code == 422


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="Exige concorrência PostgreSQL")
def test_desafio_concorrente_autentica_uma_vez(client, db, google, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy.orm import Session
    from app.services import google as service

    tentativa = desafio(client)
    token = google(tentativa["nonce"])
    original = service.verificar_token_google
    barreira = Barrier(2)

    def verificar(*args):
        identidade = original(*args)
        barreira.wait(timeout=15)
        return identidade

    monkeypatch.setattr(service, "verificar_token_google", verificar)
    engine = db.get_bind()

    def autenticar(_):
        with Session(engine) as sessao:
            try:
                service.autenticar_google(sessao, UUID(tentativa["desafio_id"]), token)
                return 200
            except google_auth.FalhaGoogle as exc:
                return exc.status

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(autenticar, (1, 2))) == [200, 401]
    assert db.scalar(select(func.count()).select_from(Usuario)) == 1
