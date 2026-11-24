import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import issue_access_token
from app.db.session import get_db
from app.main import app
from app.models import DoadorPessoaFisica, Organizacao, Usuario

pytestmark = pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="Exige PostgreSQL")
ROTA = "/api/doacoes"


def conta(db, nome, tipo, aprovado=True):
    usuario = Usuario(nome=nome, email=f"{nome}@example.org")
    db.add(usuario)
    db.flush()
    campos = dict(
        usuario_responsavel_id=usuario.id, nome=nome, email_contato=usuario.email,
        telefone="82999991234", logradouro="Rua A", numero="10", bairro="Centro",
        cidade="Arapiraca", uf="AL", cep="57300000",
        status_verificacao="APROVADA" if aprovado else "PENDENTE",
    )
    if tipo == "PESSOA_FISICA":
        cadastro = DoadorPessoaFisica(cpf="52998224725", **campos)
    else:
        cnpj = str(db.scalar(text("SELECT count(*) FROM organizacoes")) + 1).zfill(14)
        cadastro = Organizacao(tipo=tipo, cnpj=cnpj, capacidade_atendimento=10 if tipo == "ONG" else None, **campos)
    db.add(cadastro)
    db.commit()
    return {"Authorization": f"Bearer {issue_access_token(usuario.id)}"}, str(cadastro.id)


def publicacao(client, auth):
    catalogo = client.get(f"{ROTA}/catalogo", headers=auth).json()
    agora = datetime.now(timezone.utc)
    return {
        "categoria": catalogo["categorias"][0], "descricao": "Alimentos para teste",
        "quantidade": "2.500", "unidade": "kg", "modalidade": "RETIRADA",
        "inicio_retirada": (agora + timedelta(days=1)).isoformat(),
        "fim_retirada": (agora + timedelta(days=1, hours=2)).isoformat(),
        "validade_em": (agora + timedelta(days=2)).isoformat(),
        "termo_id": catalogo["termo"]["id"],
        "checklist": dict.fromkeys(("temperatura", "embalagem", "validade", "conservacao", "termo"), True),
    }


@pytest.mark.parametrize("tipo", ["DOADOR", "PESSOA_FISICA"])
def test_publicacao_e_reserva_em_sessoes_independentes(db, tipo):
    doador, doador_id = conta(db, "doador", tipo)
    ong, ong_id = conta(db, "ong", "ONG")
    concorrente, _ = conta(db, "outra", "ONG")
    pendente, _ = conta(db, "pendente", "ONG", aprovado=False)
    engine = db.get_bind()

    def sessao():
        with Session(engine) as sessao_db:
            yield sessao_db

    app.dependency_overrides[get_db] = sessao
    try:
        with TestClient(app, headers=doador) as navegador_doador, TestClient(app, headers=ong) as navegador_ong:
            dados = publicacao(navegador_doador, doador)
            assert navegador_ong.post(ROTA, json=dados).status_code == 403
            incompleto = {**dados, "checklist": {**dados["checklist"], "termo": False}}
            assert navegador_doador.post(ROTA, json=incompleto).status_code == 422
            resposta = navegador_doador.post(ROTA, json=dados)
            assert resposta.status_code == 201, resposta.text
            id_oferta = resposta.json()["id"]
            assert navegador_ong.get(ROTA).json()[0]["doadorId"] == doador_id
            reserva = f"{ROTA}/{id_oferta}/reserva"
            assert navegador_ong.post(reserva, headers=pendente).status_code == 403

            barreira = Barrier(2)

            def tentar(auth):
                with TestClient(app, headers=auth) as navegador:
                    barreira.wait(timeout=10)
                    return navegador.post(reserva)

            with ThreadPoolExecutor(max_workers=2) as executor:
                primeira, segunda = executor.map(tentar, [ong, concorrente])
            assert sorted([primeira.status_code, segunda.status_code]) == [200, 409]
            ganhadora = ong if primeira.status_code == 200 else concorrente
            perdedora = concorrente if primeira.status_code == 200 else ong

            with TestClient(app, headers=ganhadora) as novo_navegador_ong:
                oferta = novo_navegador_ong.get(ROTA).json()[0]
                assert oferta["id"] == id_oferta
                assert oferta["status"] == "RESERVADA"
                if ganhadora == ong:
                    assert oferta["ongId"] == ong_id
                assert novo_navegador_ong.post(reserva).status_code == 200
            assert navegador_ong.get(ROTA, headers=perdedora).json() == []
            assert navegador_doador.get(ROTA).json()[0]["status"] == "RESERVADA"

        argumentos = {"id": UUID(id_oferta)}
        assert db.scalar(text("SELECT count(*) FROM solicitacoes_doacao WHERE doacao_id = :id"), argumentos) == 1
        assert db.scalar(text("SELECT count(*) FROM triagens_doacao WHERE doacao_id = :id"), argumentos) == 1
        assert db.scalar(text("SELECT count(*) FROM historico_doacao WHERE doacao_id = :id"), argumentos) == 2
    finally:
        app.dependency_overrides.pop(get_db, None)

@pytest.mark.parametrize("modalidade", ["RETIRADA", "ENTREGA"])
def test_recebimento_registra_checklist_e_status(client, db, modalidade):
    doador, _ = conta(db, "doador", "DOADOR")
    ong, _ = conta(db, "ong", "ONG")
    outra, _ = conta(db, "outra", "ONG")
    dados = {**publicacao(client, doador), "modalidade": modalidade}
    publicada = client.post(ROTA, headers=doador, json=dados)
    assert publicada.status_code == 201, publicada.text
    id_oferta = UUID(publicada.json()["id"])
    base = f"{ROTA}/{id_oferta}"
    assert client.post(f"{base}/reserva", headers=ong).status_code == 200
    assert client.post(f"{base}/cancelamento", headers=doador).status_code == 409
    checklist = {chave: True for chave in ("temperatura", "embalagem", "validade", "conservacao")}
    assert client.post(f"{base}/recebimento", headers=outra, json=checklist).status_code == 403
    assert client.post(f"{base}/recebimento", headers=ong, json=checklist).status_code == 409

    db.execute(text("""
        UPDATE doacoes SET inicio_retirada = now() - interval '1 hour' WHERE id = :id
    """), {"id": id_oferta})
    db.commit()
    retirada = client.post(f"{base}/retirada", headers=ong)
    assert retirada.status_code == (200 if modalidade == "RETIRADA" else 409)
    assert client.post(f"{base}/recebimento", headers=ong, json={}).status_code == 422
    for _ in range(2):
        resposta = client.post(f"{base}/recebimento", headers=ong, json=checklist)
        assert resposta.status_code == 200, resposta.text
        assert resposta.json()["status"] == "ENTREGUE"

    for auth in (ong, doador):
        assert client.get(ROTA, headers=auth).json()[0]["status"] == "ENTREGUE"
    assert db.scalar(text("""
        SELECT respostas FROM triagens_doacao WHERE doacao_id = :id AND etapa = 'ONG_RECEBIMENTO'
    """), {"id": id_oferta}) == checklist
    assert db.scalar(text("""
        SELECT count(*) FROM historico_doacao WHERE doacao_id = :id AND status_novo = 'ENTREGUE'
    """), {"id": id_oferta}) == 1


def test_cancelamento_e_expiracao_preservam_historico(client, db):
    from app.services.doacoes import encerrar_vencidas

    doador, _ = conta(db, "doador", "PESSOA_FISICA")
    outro, _ = conta(db, "outro", "DOADOR")
    ong, _ = conta(db, "ong", "ONG")
    dados = publicacao(client, doador)
    ids = [UUID(client.post(ROTA, headers=doador, json=dados).json()["id"]) for _ in range(3)]
    cancelar = f"{ROTA}/{ids[0]}/cancelamento"
    assert client.post(cancelar, headers=outro).status_code == 403
    assert client.post(cancelar, headers=doador).json()["status"] == "CANCELADA"
    assert client.post(f"{ROTA}/{ids[1]}/reserva", headers=ong).status_code == 200

    db.execute(text("""
        UPDATE doacoes SET inicio_retirada = now() - interval '2 hours',
                           fim_retirada = now() - interval '1 hour'
        WHERE id = ANY(:ids)
    """), {"ids": ids[1:]})
    db.commit()
    encerrar_vencidas(db)
    encerrar_vencidas(db)
    status_doador = {item["id"]: item["status"] for item in client.get(ROTA, headers=doador).json()}
    assert status_doador == {str(ids[0]): "CANCELADA", str(ids[1]): "ENCERRADA", str(ids[2]): "ENCERRADA"}
    assert [(item["id"], item["status"]) for item in client.get(ROTA, headers=ong).json()] == [
        (str(ids[1]), "ENCERRADA")
    ]
    assert db.execute(text("""
        SELECT status_anterior, alterado_por_id FROM historico_doacao
        WHERE status_novo = 'ENCERRADA' ORDER BY status_anterior
    """)).all() == [("DISPONIVEL", None), ("RESERVADA", None)]

def test_ong_gerencia_apenas_as_proprias_necessidades(client, db):
    ong, _ = conta(db, "ong", "ONG")
    outra, _ = conta(db, "outra", "ONG")
    doador, _ = conta(db, "doador", "DOADOR")
    pendente, _ = conta(db, "pendente", "ONG", aprovado=False)
    rota = "/api/necessidades"

    for auth in (doador, pendente):
        assert client.get(rota, headers=auth).status_code == 403
    resposta = client.get(rota, headers=ong)
    assert resposta.status_code == 200, resposta.text
    categoria = resposta.json()["categorias"][0]
    assert resposta.json()["itens"] == []
    dados = {"categoria": categoria, "quantidade": "2.125", "unidade": "kg", "observacao": "  Urgente  "}
    for invalido in ({"quantidade": 0}, {"quantidade": "0.0001"}, {"unidade": "saco"}, {"categoria": "Inexistente"}):
        assert client.post(rota, headers=ong, json={**dados, **invalido}).status_code == 422

    criada = client.post(rota, headers=ong, json=dados)
    assert criada.status_code == 201, criada.text
    identificador = criada.json()["id"]
    item = f"{rota}/{identificador}"
    assert client.get(rota, headers=outra).json()["itens"] == []
    assert client.put(item, headers=outra, json=dados).status_code == 404
    assert client.post(f"{item}/desativacao", headers=outra).status_code == 404
    atual = client.get(rota, headers=ong).json()["itens"][0]
    assert atual["quantidade"] == 2.125
    assert atual["observacao"] == "Urgente"

    alterada = client.put(item, headers=ong, json={**dados, "quantidade": 4, "observacao": ""})
    assert alterada.status_code == 200, alterada.text
    for _ in range(2):
        assert client.post(f"{item}/desativacao", headers=ong).json()["ativa"] is False
    assert client.put(item, headers=ong, json=dados).status_code == 404
    atual = client.get(rota, headers=ong).json()["itens"][0]
    assert (atual["id"], atual["quantidade"], atual["observacao"], atual["ativa"]) == (identificador, 4, None, False)
