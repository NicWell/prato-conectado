from fastapi import HTTPException
from sqlalchemy import func, literal, select, union_all, update
from sqlalchemy.orm import Session

from app.models import AnaliseCadastro, DoadorPessoaFisica, Notificacao, Organizacao, Usuario
from app.schemas.admin import CadastroDetalhe


def modelo_perfil(perfil):
    return DoadorPessoaFisica if perfil == "PESSOA_FISICA" else Organizacao


def consulta_perfil(modelo, perfil):
    consulta = select(modelo).where(modelo.id == perfil[1])
    if modelo is Organizacao:
        consulta = consulta.where(modelo.tipo == ("ONG" if perfil[0] == "ONG" else "DOADOR"))
    return consulta


def listar_cadastros(db, status, perfil, busca, pagina, tamanho):
    partes = []
    for tipo_perfil in ("ONG", "EMPRESA", "PESSOA_FISICA"):
        if perfil and perfil != tipo_perfil:
            continue
        modelo = modelo_perfil(tipo_perfil)
        consulta = select(
            modelo.id, literal(tipo_perfil).label("perfil"), modelo.nome,
            Usuario.nome.label("responsavel"), Usuario.email,
            modelo.cidade, modelo.uf, modelo.status_verificacao.label("status"), modelo.criado_em,
        ).join(Usuario, Usuario.id == modelo.usuario_responsavel_id)
        if modelo is Organizacao:
            consulta = consulta.where(modelo.tipo == ("ONG" if tipo_perfil == "ONG" else "DOADOR"))
        if status:
            consulta = consulta.where(modelo.status_verificacao == status)
        if busca:
            consulta = consulta.where(modelo.nome.icontains(busca, autoescape=True) | Usuario.email.icontains(busca, autoescape=True))
        partes.append(consulta)
    registros = union_all(*partes).subquery()
    total = db.scalar(select(func.count()).select_from(registros))
    itens = db.execute(select(registros).order_by(registros.c.criado_em, registros.c.perfil, registros.c.id)
                       .offset((pagina - 1) * tamanho).limit(tamanho)).mappings().all()
    return {"itens": itens, "total": total, "pagina": pagina, "tamanho": tamanho}


def detalhar_cadastro(db, perfil, cadastro_id):
    modelo = modelo_perfil(perfil)
    cadastro = db.scalar(consulta_perfil(modelo, (perfil, cadastro_id)).execution_options(populate_existing=True))
    if cadastro is None:
        raise HTTPException(404, "Cadastro não encontrado.")
    usuario = db.get(Usuario, cadastro.usuario_responsavel_id)
    alvo = AnaliseCadastro.doador_pf_id if modelo is DoadorPessoaFisica else AnaliseCadastro.organizacao_id
    historico = db.scalars(select(AnaliseCadastro).where(alvo == cadastro.id)
                           .order_by(AnaliseCadastro.analisado_em.desc(), AnaliseCadastro.id)).all()
    campos = {campo: getattr(cadastro, campo) for campo in (
        "id", "nome", "cidade", "uf", "criado_em", "email_contato", "telefone", "logradouro",
        "numero", "complemento", "bairro", "cep",
    )}
    return CadastroDetalhe(**campos, perfil=perfil, responsavel=usuario.nome, email=usuario.email,
                           usuario_id=usuario.id, documento=getattr(cadastro, "cpf" if modelo is DoadorPessoaFisica else "cnpj"),
                           status=cadastro.status_verificacao, capacidade_atendimento=getattr(cadastro, "capacidade_atendimento", None),
                           historico=historico)


def decidir_cadastro(db: Session, administrador, perfil, cadastro_id, dados):
    modelo = modelo_perfil(perfil)
    try:
        cadastro = db.scalar(consulta_perfil(modelo, (perfil, cadastro_id)))
        if cadastro is None:
            raise HTTPException(404, "Cadastro não encontrado.")
        if cadastro.usuario_responsavel_id == administrador.id:
            raise HTTPException(403, "Não é permitido analisar o próprio cadastro.")
        # Compare-and-set: só uma requisição consegue decidir um cadastro pendente.
        resultado = db.execute(update(modelo).where(modelo.id == cadastro_id, modelo.status_verificacao == "PENDENTE")
                               .values(status_verificacao=dados.decisao).execution_options(synchronize_session=False))
        if resultado.rowcount != 1:
            raise HTTPException(409, "Este cadastro já foi analisado. Atualize a consulta.")
        db.add(AnaliseCadastro(
            organizacao_id=cadastro_id if modelo is Organizacao else None,
            doador_pf_id=cadastro_id if modelo is DoadorPessoaFisica else None,
            administrador_id=administrador.id, decisao=dados.decisao, justificativa=dados.justificativa,
        ))
        mensagem = f"O cadastro de {cadastro.nome} foi {'aprovado' if dados.decisao == 'APROVADA' else 'reprovado'}."
        if dados.justificativa:
            mensagem += f" Justificativa: {dados.justificativa}"
        db.add(Notificacao(usuario_id=cadastro.usuario_responsavel_id, tipo="ANALISE_CADASTRO",
                           titulo="Resultado da análise cadastral", mensagem=mensagem))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return detalhar_cadastro(db, perfil, cadastro_id)
