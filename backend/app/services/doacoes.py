import json
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text

from app.models import DoadorPessoaFisica, Organizacao


def perfil_operacional(db, usuario, perfil, tipo):
    modelo = DoadorPessoaFisica if perfil.perfil == "PESSOA_FISICA" else Organizacao
    cadastro = db.get(modelo, UUID(perfil.id))
    if (
        usuario.papel_sistema != "USUARIO"
        or not cadastro
        or cadastro.usuario_responsavel_id != usuario.id
        or cadastro.status_verificacao != "APROVADA"
        or perfil.tipo not in tipo
    ):
        raise HTTPException(403, "A operação exige um perfil aprovado e autorizado.")
    return cadastro


def categorias_ativas(db):
    return db.scalars(text("SELECT nome FROM categorias_alimento WHERE ativa ORDER BY nome")).all()


def catalogo(db):
    categorias = categorias_ativas(db)
    termo = db.execute(text("""
        SELECT id, versao, titulo, conteudo FROM termos_responsabilidade
        WHERE ativo ORDER BY criado_em DESC, id DESC LIMIT 1
    """)).mappings().first()
    if termo is None:
        raise HTTPException(503, "Nenhum termo de responsabilidade está disponível.")
    return {"categorias": categorias, "termo": dict(termo)}


def listar(db, cadastro, tipo):
    return [dict(row) for row in db.execute(text("""
        SELECT d.id, COALESCE(d.doador_id, d.doador_pf_id) AS "doadorId",
               s.ong_id AS "ongId", COALESCE(o.nome, pf.nome) AS "doadorNome",
               ong.nome AS "ongNome",
               CASE WHEN :tipo = 'ONG' THEN v.nome END AS "voluntarioNome", d.status, i.descricao, i.quantidade, i.unidade,
               c.nome AS categoria, d.modalidade AS entrega, i.validade_em,
               d.inicio_retirada, d.fim_retirada
        FROM doacoes d
        LEFT JOIN organizacoes o ON o.id = d.doador_id
        LEFT JOIN doadores_pessoa_fisica pf ON pf.id = d.doador_pf_id
        JOIN LATERAL (
            SELECT * FROM itens_doacao WHERE doacao_id = d.id ORDER BY id LIMIT 1
        ) i ON TRUE
        JOIN categorias_alimento c ON c.id = i.categoria_id
        LEFT JOIN solicitacoes_doacao s ON s.doacao_id = d.id AND s.status = 'ACEITA'
        LEFT JOIN organizacoes ong ON ong.id = s.ong_id
        LEFT JOIN voluntarios v ON v.id = s.voluntario_id AND v.ong_id = s.ong_id
        WHERE (:tipo = 'DOADOR' AND (d.doador_id = :id OR d.doador_pf_id = :id))
           OR (:tipo = 'ONG' AND (s.ong_id = :id OR (
               d.status = 'DISPONIVEL' AND d.fim_retirada > now()
               AND COALESCE(o.status_verificacao, pf.status_verificacao) = 'APROVADA'
               AND NOT EXISTS (
                   SELECT 1 FROM itens_doacao vencido
                   WHERE vencido.doacao_id = d.id AND vencido.validade_em <= now()
               )
           )))
        ORDER BY d.criado_em DESC, d.id DESC
    """), {"tipo": tipo, "id": cadastro.id}).mappings()]


def publicar(db, cadastro, usuario, dados):
    agora = db.scalar(text("SELECT clock_timestamp()"))
    if not agora < dados.inicio_retirada < dados.fim_retirada < dados.validade_em:
        raise HTTPException(422, "Informe uma janela futura, anterior ao fim da validade.")
    categoria_id = db.scalar(text("""
        SELECT id FROM categorias_alimento WHERE nome = :nome AND ativa FOR SHARE
    """), {"nome": dados.categoria})
    if categoria_id is None:
        raise HTTPException(422, "Selecione uma categoria ativa.")
    if dados.termo_id != catalogo(db)["termo"]["id"]:
        raise HTTPException(409, "O termo foi atualizado. Reabra o formulário e leia a nova versão.")

    pessoa_fisica = isinstance(cadastro, DoadorPessoaFisica)
    valores = {
        **dados.model_dump(exclude={"checklist"}),
        "categoria_id": categoria_id,
        "titulo": dados.descricao,
        "usuario_id": usuario.id,
        "organizacao_id": None if pessoa_fisica else cadastro.id,
        "doador_pf_id": cadastro.id if pessoa_fisica else None,
        "respostas": json.dumps(dados.checklist.model_dump(exclude={"termo"})),
    }
    db.execute(text("""
        INSERT INTO aceites_termo (termo_id, usuario_id, organizacao_id, doador_pf_id)
        VALUES (:termo_id, :usuario_id, :organizacao_id, :doador_pf_id)
        ON CONFLICT DO NOTHING
    """), valores)
    valores["aceite_id"] = db.scalar(text("""
        SELECT id FROM aceites_termo
        WHERE termo_id = :termo_id AND usuario_id = :usuario_id
          AND (organizacao_id = :organizacao_id OR doador_pf_id = :doador_pf_id)
    """), valores)
    valores["doacao_id"] = db.scalar(text("""
        INSERT INTO doacoes (doador_id, doador_pf_id, criado_por_id, aceite_termo_id, titulo,
                             descricao, modalidade, inicio_retirada, fim_retirada, status)
        VALUES (:organizacao_id, :doador_pf_id, :usuario_id, :aceite_id, :titulo,
                :descricao, :modalidade, :inicio_retirada, :fim_retirada, 'DISPONIVEL')
        RETURNING id
    """), valores)
    db.execute(text("""
        INSERT INTO itens_doacao (doacao_id, categoria_id, descricao, quantidade, unidade, validade_em)
        VALUES (:doacao_id, :categoria_id, :descricao, :quantidade, :unidade, :validade_em)
    """), valores)
    db.execute(text("""
        INSERT INTO triagens_doacao (doacao_id, organizacao_id, doador_pf_id, preenchido_por_id,
                                    etapa, resultado, respostas)
        VALUES (:doacao_id, :organizacao_id, :doador_pf_id, :usuario_id,
                'DOADOR_CADASTRO', 'APTA', CAST(:respostas AS jsonb))
    """), valores)
    db.execute(text("""
        INSERT INTO historico_doacao (doacao_id, alterado_por_id, status_novo)
        VALUES (:doacao_id, :usuario_id, 'DISPONIVEL')
    """), valores)
    db.commit()
    return {"id": valores["doacao_id"], "status": "DISPONIVEL"}


def reservar(db, ong, usuario, doacao_id):
    valores = {"id": doacao_id, "ong_id": ong.id, "usuario_id": usuario.id}
    oferta = db.execute(text("""
        SELECT status FROM doacoes WHERE id = :id FOR UPDATE
    """), valores).first()
    if oferta is None:
        raise HTTPException(404, "Doação não encontrada.")
    if oferta.status == "RESERVADA" and db.scalar(text("""
        SELECT id FROM solicitacoes_doacao
        WHERE doacao_id = :id AND ong_id = :ong_id AND status = 'ACEITA'
    """), valores):
        return {"id": doacao_id, "status": "RESERVADA"}

    atualizada = db.scalar(text("""
        UPDATE doacoes d SET status = 'RESERVADA', atualizado_em = clock_timestamp()
        WHERE d.id = :id AND d.status = 'DISPONIVEL' AND d.fim_retirada > clock_timestamp()
          AND EXISTS (SELECT 1 FROM itens_doacao WHERE doacao_id = d.id)
          AND NOT EXISTS (
              SELECT 1 FROM itens_doacao WHERE doacao_id = d.id AND validade_em <= clock_timestamp()
          )
          AND (
              EXISTS (SELECT 1 FROM organizacoes WHERE id = d.doador_id AND status_verificacao = 'APROVADA')
              OR EXISTS (SELECT 1 FROM doadores_pessoa_fisica WHERE id = d.doador_pf_id AND status_verificacao = 'APROVADA')
          )
        RETURNING d.id
    """), valores)
    if atualizada is None:
        raise HTTPException(409, "Esta doação já não está disponível.")
    db.execute(text("""
        INSERT INTO solicitacoes_doacao (doacao_id, ong_id, solicitado_por_id, status, respondido_em)
        VALUES (:id, :ong_id, :usuario_id, 'ACEITA', clock_timestamp())
        ON CONFLICT (doacao_id, ong_id) WHERE status IN ('PENDENTE', 'ACEITA')
        DO UPDATE SET status = 'ACEITA', respondido_em = EXCLUDED.respondido_em
    """), valores)
    db.execute(text("""
        INSERT INTO historico_doacao (doacao_id, alterado_por_id, status_anterior, status_novo)
        VALUES (:id, :usuario_id, 'DISPONIVEL', 'RESERVADA')
    """), valores)
    db.commit()
    return {"id": doacao_id, "status": "RESERVADA"}


def transicionar(db, cadastro, usuario, doacao_id, destino, checklist=None):
    valores = {"id": doacao_id, "perfil_id": cadastro.id, "usuario_id": usuario.id, "destino": destino}
    oferta = db.execute(text("""
        SELECT d.status, d.modalidade, d.doador_id, d.doador_pf_id,
               d.inicio_retirada, d.fim_retirada
        FROM doacoes d WHERE d.id = :id FOR UPDATE
    """), valores).first()
    if oferta is None:
        raise HTTPException(404, "Doação não encontrada.")

    if destino == "CANCELADA":
        autorizado = cadastro.id in (oferta.doador_id, oferta.doador_pf_id)
    else:
        autorizado = db.scalar(text("""
            SELECT EXISTS (
                SELECT 1 FROM solicitacoes_doacao
                WHERE doacao_id = :id AND ong_id = :perfil_id AND status = 'ACEITA'
            )
        """), valores)
    if not autorizado:
        raise HTTPException(403, "Seu perfil não pode alterar esta doação.")
    if oferta.status == destino:
        return {"id": doacao_id, "status": destino}

    anterior = {
        "CANCELADA": "DISPONIVEL",
        "RETIRADA": "RESERVADA",
        "ENTREGUE": "RETIRADA" if oferta.modalidade == "RETIRADA" else "RESERVADA",
    }[destino]
    if oferta.status != anterior or (destino == "RETIRADA" and oferta.modalidade != "RETIRADA"):
        raise HTTPException(409, "Esta ação não está disponível para o status ou a modalidade da doação.")

    agora = db.scalar(text("SELECT clock_timestamp()"))
    if anterior != "RETIRADA" and agora >= oferta.fim_retirada:
        raise HTTPException(409, "A janela da doação terminou.")
    if destino != "CANCELADA":
        if agora < oferta.inicio_retirada:
            raise HTTPException(409, "A janela da doação ainda não começou.")
        if db.scalar(text("""
            SELECT EXISTS (
                SELECT 1 FROM itens_doacao WHERE doacao_id = :id AND validade_em <= :agora
            )
        """), {**valores, "agora": agora}):
            raise HTTPException(409, "A validade do alimento terminou.")

    if checklist is not None:
        if checklist.voluntario_id is not None:
            if oferta.modalidade != "RETIRADA":
                raise HTTPException(422, "A doação não prevê coleta pela ONG.")
            parametros = {**valores, "voluntario_id": checklist.voluntario_id}
            voluntario = db.scalar(text("""
                SELECT id FROM voluntarios
                WHERE id = :voluntario_id AND ong_id = :perfil_id AND ativo
                FOR SHARE
            """), parametros)
            if voluntario is None:
                raise HTTPException(422, "Selecione um voluntário ativo da sua ONG.")
            db.execute(text("""
                UPDATE solicitacoes_doacao SET voluntario_id = :voluntario_id
                WHERE doacao_id = :id AND ong_id = :perfil_id AND status = 'ACEITA'
            """), parametros)
        db.execute(text("""
            INSERT INTO triagens_doacao (doacao_id, organizacao_id, preenchido_por_id,
                                        etapa, resultado, respostas)
            VALUES (:id, :perfil_id, :usuario_id, 'ONG_RECEBIMENTO', 'APTA', CAST(:respostas AS jsonb))
        """), {**valores, "respostas": json.dumps(checklist.model_dump(exclude={"voluntario_id"}))})
    db.execute(text("""
        UPDATE doacoes SET status = :destino, atualizado_em = clock_timestamp() WHERE id = :id
    """), valores)
    db.execute(text("""
        INSERT INTO historico_doacao (doacao_id, alterado_por_id, status_anterior, status_novo)
        VALUES (:id, :usuario_id, :anterior, :destino)
    """), {**valores, "anterior": anterior})
    db.commit()
    return {"id": doacao_id, "status": destino}


def encerrar_vencidas(db):
    db.execute(text("""
        WITH vencidas AS (
            SELECT d.id, d.status FROM doacoes d
            WHERE (d.status IN ('DISPONIVEL', 'RESERVADA') AND d.fim_retirada <= statement_timestamp())
               OR (d.status IN ('DISPONIVEL', 'RESERVADA', 'RETIRADA') AND EXISTS (
                   SELECT 1 FROM itens_doacao i
                   WHERE i.doacao_id = d.id AND i.validade_em <= statement_timestamp()
               ))
            ORDER BY d.id
            LIMIT 500
            FOR UPDATE OF d SKIP LOCKED
        ), encerradas AS (
            UPDATE doacoes d SET status = 'ENCERRADA', atualizado_em = clock_timestamp()
            FROM vencidas v WHERE d.id = v.id RETURNING d.id, v.status
        )
        INSERT INTO historico_doacao (doacao_id, status_anterior, status_novo, observacao)
        SELECT id, status, 'ENCERRADA', 'Prazo da doação expirado.' FROM encerradas
    """))
    db.commit()
