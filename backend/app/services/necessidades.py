from fastapi import HTTPException
from sqlalchemy import text

from app.services.doacoes import categorias_ativas


def dados_necessidade(db, ong, dados):
    categoria_id = db.scalar(text("""
        SELECT id FROM categorias_alimento WHERE nome = :nome AND ativa FOR SHARE
    """), {"nome": dados.categoria})
    if categoria_id is None:
        raise HTTPException(422, "Selecione uma categoria ativa.")
    return {
        "ong_id": ong.id,
        "categoria_id": categoria_id,
        "quantidade": dados.quantidade,
        "unidade": dados.unidade,
        "observacao": dados.observacao or None,
    }


def listar(db, ong):
    itens = db.execute(text("""
        SELECT n.id, c.nome AS categoria, n.quantidade_desejada AS quantidade,
               n.unidade, n.observacao, n.ativa, n.criado_em
        FROM necessidades_ong n JOIN categorias_alimento c ON c.id = n.categoria_id
        WHERE n.ong_id = :ong_id
        ORDER BY n.ativa DESC, n.criado_em DESC, n.id DESC
    """), {"ong_id": ong.id}).mappings()
    return {"itens": [dict(item) for item in itens], "categorias": categorias_ativas(db)}


def criar(db, ong, dados):
    identificador = db.scalar(text("""
        INSERT INTO necessidades_ong (ong_id, categoria_id, quantidade_desejada, unidade, observacao)
        VALUES (:ong_id, :categoria_id, :quantidade, :unidade, :observacao)
        RETURNING id
    """), dados_necessidade(db, ong, dados))
    db.commit()
    return {"id": identificador, "ativa": True}


def editar(db, ong, necessidade_id, dados):
    valores = {"id": necessidade_id, **dados_necessidade(db, ong, dados)}
    identificador = db.scalar(text("""
        UPDATE necessidades_ong
        SET categoria_id = :categoria_id, quantidade_desejada = :quantidade,
            unidade = :unidade, observacao = :observacao
        WHERE id = :id AND ong_id = :ong_id AND ativa
        RETURNING id
    """), valores)
    if identificador is None:
        raise HTTPException(404, "Necessidade ativa não encontrada.")
    db.commit()
    return {"id": identificador, "ativa": True}


def desativar(db, ong, necessidade_id):
    identificador = db.scalar(text("""
        UPDATE necessidades_ong SET ativa = FALSE
        WHERE id = :id AND ong_id = :ong_id
        RETURNING id
    """), {"id": necessidade_id, "ong_id": ong.id})
    if identificador is None:
        raise HTTPException(404, "Necessidade não encontrada.")
    db.commit()
    return {"id": identificador, "ativa": False}
