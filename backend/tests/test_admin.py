import os
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.core.security import issue_access_token, verify_password
from app.criar_admin import DadosAdministrador, criar_administrador
from app.models import AnaliseCadastro, CredencialLocal, Notificacao, Usuario
from test_cadastro import payload


@pytest.fixture
def admin(db):
    return criar_administrador(db, DadosAdministrador(nome="Equipe", email="admin@example.org", senha="SenhaEquipe@123"))


def headers(usuario):
    return {"Authorization": f"Bearer {issue_access_token(usuario.id)}"}


def cadastrar(client, perfil="ONG"):
    resposta = client.post("/api/auth/cadastro", json=payload(perfil))
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def test_admin_login_sem_perfil(client, db, admin):
    r = client.post("/api/auth/login", json={"email": "ADMIN@example.org", "senha": "SenhaEquipe@123"})
    assert r.status_code == 200
    assert r.json()["usuario"]["papel_sistema"] == "ADMINISTRADOR"
    assert r.json()["usuario"]["cadastro_completo"] is False
    assert client.get("/api/admin/cadastros", headers=headers(admin)).status_code == 200
    assert client.post("/api/auth/perfil", json={k: v for k, v in payload().items() if k not in {"senha", "email", "responsavel"}}, headers=headers(admin)).status_code == 403
    assert verify_password("SenhaEquipe@123", db.get(CredencialLocal, admin.id).senha_hash)


def test_conta_unica_e_nao_promove_existente(client, db, admin):
    with pytest.raises(ValueError):
        criar_administrador(db, DadosAdministrador(nome="Outra", email="outra@example.org", senha="OutraSenha@123"))
    assert db.scalar(select(func.count()).select_from(Usuario)) == 1
    db.add(Usuario(nome="Outra", email="outra@example.org", papel_sistema="ADMINISTRADOR", ativo=True))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_bloqueia_publico_em_todas_rotas(client, db):
    conta = cadastrar(client)
    caminhos = [("GET", "/api/admin/cadastros"), ("GET", f"/api/admin/cadastros/ONG/{conta['usuario']['id']}"),
                ("POST", f"/api/admin/cadastros/ONG/{conta['usuario']['id']}/decisao")]
    for metodo, caminho in caminhos:
        kwargs = {"json": {"decisao": "APROVADA"}} if metodo == "POST" else {}
        assert client.request(metodo, caminho, **kwargs).status_code == 401
        assert client.request(metodo, caminho, headers={"Authorization": f"Bearer {conta['access_token']}"}, **kwargs).status_code == 403


@pytest.mark.parametrize("perfil", ["ONG", "EMPRESA", "PESSOA_FISICA"])
@pytest.mark.parametrize("decisao", ["APROVADA", "REPROVADA"])
def test_decisao_persiste_historico_notificacao_e_situacao(client, db, admin, perfil, decisao):
    conta = cadastrar(client, perfil)
    auth = headers(admin)
    lista = client.get("/api/admin/cadastros", headers=auth).json()
    assert lista["total"] == 1
    item = lista["itens"][0]
    assert item["perfil"] == perfil
    assert "documento" not in item
    caminho = f"/api/admin/cadastros/{perfil}/{item['id']}"
    detalhe = client.get(caminho, headers=auth)
    assert detalhe.status_code == 200
    assert detalhe.json()["documento"]
    dados = {"decisao": decisao, "justificativa": " Dados incompletos. " if decisao == "REPROVADA" else None}
    resposta = client.post(caminho + "/decisao", headers=auth, json=dados)
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["status"] == decisao
    assert len(resposta.json()["historico"]) == 1
    assert resposta.json()["historico"][0]["administrador_id"] == str(admin.id)
    assert db.scalar(select(func.count()).select_from(AnaliseCadastro)) == 1
    aviso = db.scalar(select(Notificacao))
    assert str(aviso.usuario_id) == conta["usuario"]["usuario_id"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {conta['access_token']}"}).json()
    assert me["status"] == decisao
    assert me["motivo_reprovacao"] == ("Dados incompletos." if decisao == "REPROVADA" else None)
    assert client.get("/api/admin/cadastros", headers=auth).json()["total"] == 0
    assert client.get(f"/api/admin/cadastros?status={decisao}&perfil={perfil}&busca=Cadastro", headers=auth).json()["total"] == 1
    assert client.post(caminho + "/decisao", headers=auth, json=dados).status_code == 409
    assert db.scalar(select(func.count()).select_from(AnaliseCadastro)) == 1


@pytest.mark.parametrize("dados", [
    {"decisao": "REPROVADA"}, {"decisao": "REPROVADA", "justificativa": "   "},
    {"decisao": "PENDENTE"}, {"decisao": "APROVADA", "administrador_id": str(uuid4())},
    {"decisao": "REPROVADA", "justificativa": "x" * 2001},
])
def test_rejeita_decisao_invalida(client, db, admin, dados):
    conta = cadastrar(client)
    r = client.post(f"/api/admin/cadastros/ONG/{conta['usuario']['id']}/decisao", headers=headers(admin), json=dados)
    assert r.status_code == 422
    assert db.scalar(select(func.count()).select_from(AnaliseCadastro)) == 0


def test_filtros_paginacao_e_nao_encontrado(client, db, admin):
    conta = cadastrar(client)
    auth = headers(admin)
    assert client.get("/api/admin/cadastros?perfil=EMPRESA", headers=auth).json()["total"] == 0
    assert client.get("/api/admin/cadastros?busca=%25", headers=auth).json()["total"] == 0
    assert client.get("/api/admin/cadastros?pagina=2&tamanho=1", headers=auth).json()["itens"] == []
    for filtro in ["pagina=0", "tamanho=101", "perfil=ADMINISTRADOR", "status=INVALIDO"]:
        assert client.get(f"/api/admin/cadastros?{filtro}", headers=auth).status_code == 422
    assert client.get(f"/api/admin/cadastros/EMPRESA/{conta['usuario']['id']}", headers=auth).status_code == 404
    assert client.get(f"/api/admin/cadastros/ONG/{uuid4()}", headers=auth).status_code == 404
    assert client.post(f"/api/admin/cadastros/ONG/{uuid4()}/decisao", headers=auth, json={"decisao": "APROVADA"}).status_code == 404
    assert client.get("/api/admin/cadastros/ONG/invalido", headers=auth).status_code == 422


def test_papel_revogado_e_conta_inativa(client, db, admin):
    auth = headers(admin)
    admin.papel_sistema = "USUARIO"
    db.commit()
    assert client.get("/api/admin/cadastros", headers=auth).status_code == 403
    admin.ativo = False
    db.commit()
    assert client.get("/api/admin/cadastros", headers=auth).status_code == 401


def test_falha_notificacao_desfaz_decisao(client, db, admin):
    from sqlalchemy import event
    conta = cadastrar(client)
    caminho = f"/api/admin/cadastros/ONG/{conta['usuario']['id']}"
    def falhar(*args):
        raise RuntimeError("Falha simulada na persistência")
    event.listen(Notificacao, "before_insert", falhar)
    try:
        with pytest.raises(RuntimeError, match="Falha simulada"):
            client.post(caminho + "/decisao", headers=headers(admin), json={"decisao": "APROVADA"})
    finally:
        event.remove(Notificacao, "before_insert", falhar)
    assert client.get(caminho, headers=headers(admin)).json()["status"] == "PENDENTE"
    assert db.scalar(select(func.count()).select_from(AnaliseCadastro)) == 0


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="Exige PostgreSQL isolado")
def test_decisoes_concorrentes(client, db, admin):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy.orm import Session
    from fastapi import HTTPException
    from app.schemas.admin import DecisaoPayload
    from app.services.admin import decidir_cadastro
    from uuid import UUID
    conta = cadastrar(client)
    barreira = Barrier(2)
    admin_id = admin.id
    def executar(decisao):
        with Session(db.get_bind()) as sessao:
            usuario = sessao.get(Usuario, admin_id)
            barreira.wait(timeout=10)
            try:
                decidir_cadastro(sessao, usuario, "ONG", UUID(conta["usuario"]["id"]),
                                 DecisaoPayload(decisao=decisao, justificativa="Análise da equipe"))
                return 200
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(executar, ["APROVADA", "REPROVADA"])) == [200, 409]
    assert db.scalar(select(func.count()).select_from(AnaliseCadastro)) == 1
    assert db.scalar(select(func.count()).select_from(Notificacao)) == 1


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="Exige PostgreSQL isolado")
def test_migration_005_reexecutavel_preserva_historico(client, db, admin):
    from pathlib import Path
    conta = cadastrar(client)
    caminho = f"/api/admin/cadastros/ONG/{conta['usuario']['id']}/decisao"
    assert client.post(caminho, headers=headers(admin), json={"decisao": "APROVADA"}).status_code == 200
    script = Path(__file__).resolve().parents[2] / "database" / "005_painel_administrativo.sql"
    db.connection().connection.driver_connection.execute(script.read_text(encoding="utf-8"))
    db.commit()
    assert db.scalar(select(func.count()).select_from(AnaliseCadastro)) == 1
    assert db.scalar(text("SELECT count(*) FROM schema_migrations WHERE versao = '005_painel_administrativo'")) == 1
