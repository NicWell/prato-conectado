"""Executados somente com TEST_DATABASE_URL em um banco descartável."""
import os
from pathlib import Path

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="Exige PostgreSQL isolado")


def test_003_preserva_dados_anteriores():
    from uuid import uuid4
    from sqlalchemy import create_engine

    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    schema = "teste_migration_" + uuid4().hex
    scripts = Path(__file__).resolve().parents[2] / "database"
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
            conn.exec_driver_sql(f'SET search_path TO "{schema}"')
            conn.commit()
            for nome in ("schema_postgresql.sql", "002_credenciais_locais.sql"):
                conn.connection.driver_connection.execute((scripts / nome).read_text(encoding="utf-8"))
                conn.commit()
            conn.exec_driver_sql("INSERT INTO usuarios (nome, email) VALUES ('Legado', 'legado@example.org')")
            conn.exec_driver_sql("""INSERT INTO organizacoes
                (usuario_responsavel_id, tipo, nome, cnpj, email_contato, telefone,
                 logradouro, numero, bairro, cidade, uf, cep, status_verificacao)
                SELECT id, 'DOADOR', 'Empresa legada', '00000000000000', email, '82999991234',
                       'Rua A', '1', 'Centro', 'Arapiraca', 'AL', '57300000', 'APROVADA'
                FROM usuarios""")
            conn.commit()
            antes = conn.exec_driver_sql("SELECT * FROM organizacoes").all()
            conn.commit()
            conn.connection.driver_connection.execute((scripts / "003_cadastro_real.sql").read_text(encoding="utf-8"))
            conn.commit()
            conn.connection.driver_connection.execute((scripts / "004_google.sql").read_text(encoding="utf-8"))
            conn.commit()
            conn.connection.driver_connection.execute((scripts / "004_google.sql").read_text(encoding="utf-8"))
            conn.commit()
            assert conn.exec_driver_sql("SELECT * FROM organizacoes").all() == antes
            assert conn.exec_driver_sql("SELECT nome FROM usuarios").scalar_one() == "Legado"
    finally:
        with engine.begin() as conn:
            conn.exec_driver_sql(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        engine.dispose()


def test_migration_reexecutavel_preserva_cadastro(client, db):
    from test_cadastro import payload
    resposta = client.post("/api/auth/cadastro", json=payload("ONG"))
    assert resposta.status_code == 201
    usuario_id = resposta.json()["usuario"]["usuario_id"]
    script = Path(__file__).resolve().parents[2] / "database" / "003_cadastro_real.sql"
    db.connection().connection.driver_connection.execute(script.read_text(encoding="utf-8"))
    db.commit()
    assert db.scalar(text("SELECT count(*) FROM usuarios WHERE id = CAST(:id AS uuid)"), {"id": usuario_id}) == 1
    assert db.scalar(text("SELECT count(*) FROM schema_migrations WHERE versao = '003_cadastro_real'")) == 1


def test_constraints_postgres(client, db):
    from sqlalchemy.exc import IntegrityError
    from test_cadastro import payload
    assert client.post("/api/auth/cadastro", json=payload()).status_code == 201
    with pytest.raises(IntegrityError):
        db.execute(text("UPDATE organizacoes SET cnpj = '12abc34501de35'"))
    db.rollback()
    with pytest.raises(IntegrityError):
        db.execute(text("INSERT INTO usuarios (nome, email) VALUES ('Outra pessoa', 'MARIA@EXAMPLE.ORG')"))
    db.rollback()


@pytest.mark.parametrize("perfil", ["EMPRESA", "PESSOA_FISICA"])
def test_documento_concorrente_cria_uma_conta(db, monkeypatch, perfil):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy.orm import Session
    from app.services import cadastro
    from app.schemas.cadastro import CadastroPayload
    from test_cadastro import payload

    barreira = Barrier(2)
    hash_original = cadastro.hash_password

    def hash_sincronizado(senha):
        # Ambos passaram pela consulta de duplicidade e inseriram sua conta.
        barreira.wait(timeout=15)
        return hash_original(senha)

    monkeypatch.setattr(cadastro, "hash_password", hash_sincronizado)

    def criar(indice):
        dados = payload(perfil)
        dados["email"] = f"concorrente{indice}@example.org"
        with Session(db.get_bind()) as sessao:
            try:
                cadastro.cadastrar_conta(sessao, CadastroPayload(**dados))
                return 201
            except cadastro.CadastroDuplicado:
                return 409

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(criar, (1, 2))) == [201, 409]
    assert db.scalar(text("SELECT count(*) FROM usuarios")) == 1
    assert db.scalar(text("SELECT count(*) FROM credenciais_locais")) == 1
