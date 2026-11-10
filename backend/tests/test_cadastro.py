import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.security import verify_password
from app.models import CredencialLocal, DoadorPessoaFisica, Organizacao, Usuario


def payload(perfil="EMPRESA"):
    dados = {
        "tipo": "ONG" if perfil == "ONG" else "DOADOR", "perfil": perfil,
        "nome": "Cadastro de teste", "responsavel": "Maria Silva",
        "email": "  MARIA@EXAMPLE.ORG  ", "senha": "Senha@123",
        "email_contato": " CONTATO@EXAMPLE.ORG ", "telefone": "(82) 99999-1234",
        "logradouro": "Rua A", "numero": "10", "bairro": "Centro",
        "cidade": "Arapiraca", "uf": "al", "cep": "57300-000",
    }
    if perfil == "PESSOA_FISICA":
        dados["cpf"] = "529.982.247-25"
    else:
        dados["cnpj"] = "11.222.333/0001-81"
    if perfil == "ONG":
        dados["capacidade_atendimento"] = 100
    return dados


@pytest.mark.parametrize("perfil", ["EMPRESA", "ONG", "PESSOA_FISICA"])
def test_cadastro_login_me(client, db, perfil):
    dados = payload(perfil)
    resposta = client.post("/api/auth/cadastro", json=dados)
    assert resposta.status_code == 201, resposta.text
    corpo = resposta.json()
    assert corpo["usuario"]["status"] == "PENDENTE"
    assert corpo["usuario"]["perfil"] == perfil
    assert corpo["usuario"]["tipo"] == dados["tipo"]
    assert corpo["usuario"]["papel_sistema"] == "USUARIO"
    assert corpo["usuario"]["email"] == "maria@example.org"
    usuario = db.scalar(select(Usuario))
    credencial = db.get(CredencialLocal, usuario.id)
    assert credencial.senha_hash.startswith("$argon2id$")
    assert verify_password(dados["senha"], credencial.senha_hash)
    modelo = DoadorPessoaFisica if perfil == "PESSOA_FISICA" else Organizacao
    cadastro = db.scalar(select(modelo))
    assert cadastro.cep == "57300000"
    assert cadastro.telefone == "82999991234"
    assert cadastro.uf == "AL"
    assert corpo["usuario"]["id"] == str(cadastro.id)
    assert db.scalar(select(func.count()).select_from(Usuario)) == 1
    login = client.post("/api/auth/login", json={"email": "MARIA@EXAMPLE.ORG", "senha": dados["senha"]})
    assert login.status_code == 200
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {corpo['access_token']}"})
    assert me.json() == corpo["usuario"]
    for segredo in ("senha_hash", dados["senha"], "cpf", "cnpj"):
        assert segredo not in resposta.text


def test_cnpj_alfanumerico(client, db):
    dados = payload("ONG")
    dados["cnpj"] = "12.abc.345/01de-35"
    resposta = client.post("/api/auth/cadastro", json=dados)
    assert resposta.status_code == 201, resposta.text
    assert db.scalar(select(Organizacao)).cnpj == "12ABC34501DE35"


@pytest.mark.parametrize("alteracao", [
    {"cnpj": "11.222.333/0001-80"}, {"cnpj": "11.111.111/1111-11"},
    {"cnpj": "!11222333000181"}, {"cnpj": None},
    {"cpf": "52998224725"}, {"tipo": "ONG"}, {"perfil": "ONG"},
    {"cep": "123"}, {"cep": "123456789"}, {"uf": "XX"},
    {"telefone": "abc82999991234"}, {"telefone": "9999"},
    {"email": "invalido"}, {"senha": "curta"}, {"senha": "        "},
    {"nome": "   "}, {"numero": ""}, {"logradouro": "A" * 181},
    {"capacidade_atendimento": 20}, {"status": "APROVADA"},
    {"papel_sistema": "ADMINISTRADOR"}, {"google_sub": "arbitrario"},
])
def test_cadastro_invalido_nao_persiste(client, db, alteracao):
    dados = payload()
    dados.update(alteracao)
    resposta = client.post("/api/auth/cadastro", json=dados)
    assert resposta.status_code == 422, resposta.text
    assert dados["senha"] not in resposta.text
    assert '"input"' not in resposta.text
    assert db.scalar(select(func.count()).select_from(Usuario)) == 0


@pytest.mark.parametrize("perfil,alteracao", [
    ("ONG", {"capacidade_atendimento": None}), ("ONG", {"capacidade_atendimento": 0}),
    ("ONG", {"capacidade_atendimento": True}), ("ONG", {"capacidade_atendimento": 1.5}),
    ("ONG", {"perfil": "PESSOA_FISICA"}),
    ("PESSOA_FISICA", {"cpf": "11111111111"}),
    ("PESSOA_FISICA", {"cpf": "52998224724"}),
    ("PESSOA_FISICA", {"cpf": None}),
    ("PESSOA_FISICA", {"cnpj": "11222333000181"}),
])
def test_regras_especificas(client, perfil, alteracao):
    dados = payload(perfil)
    dados.update(alteracao)
    assert client.post("/api/auth/cadastro", json=dados).status_code == 422


@pytest.mark.parametrize("perfil", ["EMPRESA", "PESSOA_FISICA"])
def test_duplicidade_e_rollback(client, db, perfil):
    dados = payload(perfil)
    assert client.post("/api/auth/cadastro", json=dados).status_code == 201
    # E-mail é único inclusive quando muda a capitalização.
    dados["email"] = "Maria@example.org"
    assert client.post("/api/auth/cadastro", json=dados).status_code == 409
    # Documento é único mesmo com outro e-mail.
    dados["email"] = "outro@example.org"
    assert client.post("/api/auth/cadastro", json=dados).status_code == 409
    assert db.scalar(select(func.count()).select_from(Usuario)) == 1
    assert db.scalar(select(func.count()).select_from(CredencialLocal)) == 1


def test_conflito_concorrente_desfaz_conta(client, db, monkeypatch):
    from app.services import cadastro
    original = db.flush

    def conflito(*args, **kwargs):
        original(*args, **kwargs)
        # Simula conflito de unicidade após inserir usuário.
        raise IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed: organizacoes.cnpj"))

    monkeypatch.setattr(db, "flush", conflito)
    assert client.post("/api/auth/cadastro", json=payload()).status_code == 409
    monkeypatch.setattr(db, "flush", original)
    assert db.scalar(select(func.count()).select_from(Usuario)) == 0


def test_falha_hash_desfaz_conta(client, db, monkeypatch):
    from app.services import cadastro

    def falhar(senha):
        raise RuntimeError("Falha simulada")

    monkeypatch.setattr(cadastro, "hash_password", falhar)
    with pytest.raises(RuntimeError, match="Falha simulada"):
        client.post("/api/auth/cadastro", json=payload())
    assert db.scalar(select(func.count()).select_from(Usuario)) == 0
