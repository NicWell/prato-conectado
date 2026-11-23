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
