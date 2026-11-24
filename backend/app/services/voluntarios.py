from sqlalchemy import text


def listar(db, ong):
    registros = db.execute(text("""
        SELECT id, nome, email, telefone, logradouro, numero, bairro, cidade, uf, cep, ativo
        FROM voluntarios WHERE ong_id = :ong_id
        ORDER BY nome, id
    """), {"ong_id": ong.id}).mappings()
    return [dict(registro) for registro in registros]


def cadastrar(db, ong, dados):
    voluntario_id = db.scalar(text("""
        INSERT INTO voluntarios (ong_id, nome, email, telefone, logradouro, numero, bairro, cidade, uf, cep)
        VALUES (:ong_id, :nome, :email, :telefone, :logradouro, :numero, :bairro, :cidade, :uf, :cep)
        RETURNING id
    """), {"ong_id": ong.id, **dados.model_dump()})
    db.commit()
    return {"id": voluntario_id}
