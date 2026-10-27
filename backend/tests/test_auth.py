import uuid
from app.core.security import hash_password, issue_access_token
from app.models import CredencialLocal, Organizacao, Usuario


def create_user(db, email="doador@teste.com", senha="SenhaForte@123", active=True, status="APROVADA"):
    u = Usuario(id=uuid.uuid4(), nome="Carlos", email=email, ativo=active, papel_sistema="USUARIO")
    db.add(u)
    db.flush()
    db.add(CredencialLocal(usuario_id=u.id, senha_hash=hash_password(senha)))
    db.add(Organizacao(usuario_responsavel_id=u.id, tipo="DOADOR", nome="Padaria Teste", cnpj="00000000000000",
                        email_contato=email, telefone="(82) 99999-9999", logradouro="Rua Teste", numero="1",
                        bairro="Centro", cidade="Maceió", uf="AL", cep="57000000", status_verificacao=status))
    db.commit()
    return u


def test_login_and_me(client, db):
    u = create_user(db)
    r = client.post("/api/auth/login", json={"email": "DOADOR@TESTE.COM", "senha": "SenhaForte@123"})
    assert r.status_code == 200, r.text
    dados = r.json()
    assert dados["token_type"] == "bearer"
    assert dados["usuario"]["tipo"] == "DOADOR"
    assert dados["usuario"]["status"] == "APROVADA"
    assert dados["usuario"]["usuario_id"] == str(u.id)
    assert "senha_hash" not in str(dados)
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {dados['access_token']}"})
    assert me.status_code == 200
    assert me.json()["usuario_id"] == str(u.id)


def test_invalid_credentials(client, db):
    create_user(db)
    for email, senha in [("doador@teste.com", "Errada"), ("desconhecido@teste.com", "SenhaForte@123")]:
        response = client.post("/api/auth/login", json={"email": email, "senha": senha})
        assert response.status_code == 401
        assert response.json()["detail"] == "E-mail ou senha incorretos."


def test_inactive_and_pending(client, db):
    create_user(db, active=False)
    assert client.post("/api/auth/login", json={"email": "doador@teste.com", "senha": "SenhaForte@123"}).status_code == 401


def test_pending_logs_in_but_not_approved(client, db):
    create_user(db, status="PENDENTE")
    resp = client.post("/api/auth/login", json={"email": "doador@teste.com", "senha": "SenhaForte@123"})
    assert resp.status_code == 200
    assert resp.json()["usuario"]["status"] == "PENDENTE"


def test_token_required_and_invalid(client, db):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer invalid-token"}).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {issue_access_token(uuid.uuid4())}"}).status_code == 401


def test_expired_token(client, db):
    from datetime import datetime, timedelta, timezone
    import jwt
    from app.core.config import settings
    from app.core.security import ISSUER, AUDIENCE
    u = create_user(db)
    now = datetime.now(timezone.utc)
    token = jwt.encode({
        "sub": str(u.id), "iss": ISSUER, "aud": AUDIENCE,
        "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1), "type": "access",
    }, settings.jwt_secret_key, algorithm="HS256")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_cors_local_origin(client):
    resp = client.options("/api/auth/login", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
