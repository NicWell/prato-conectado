-- PRATO CONECTADO | ESQUEMA INICIAL (PostgreSQL 13+)
-- Escopo: documentacao/modelagem. A execucao deste SQL cria apenas o banco.
-- Nao executa Google OAuth, verificacao de CNPJ, expiracao automatica nem regra de publicacao.
-- Crie o banco de dados antes de executar este script.
-- gen_random_uuid() ja vem no PostgreSQL 13+; nenhuma extensao e necessaria.

-- Pessoas autenticadas por conta Google e administradores da plataforma.
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub VARCHAR(255) NOT NULL UNIQUE,
    nome VARCHAR(160) NOT NULL,
    email VARCHAR(255) NOT NULL,
    papel_sistema VARCHAR(20) NOT NULL DEFAULT 'USUARIO',
    CONSTRAINT chk_usuarios_papel_sistema_1 CHECK (papel_sistema IN ('USUARIO', 'ADMINISTRADOR')),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cadastro comum a doadores e ONGs, com aprovação administrativa.
CREATE TABLE organizacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_responsavel_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(12) NOT NULL,
    CONSTRAINT chk_organizacoes_tipo_1 CHECK (tipo IN ('DOADOR', 'ONG')),
    nome VARCHAR(180) NOT NULL,
    cnpj CHAR(14) NOT NULL UNIQUE,
    CONSTRAINT chk_organizacoes_cnpj_1 CHECK (cnpj ~ '^[0-9]{14}$'),
    email_contato VARCHAR(255) NOT NULL,
    telefone VARCHAR(25) NOT NULL,
    logradouro VARCHAR(180) NOT NULL,
    numero VARCHAR(15) NOT NULL,
    complemento VARCHAR(120),
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(120) NOT NULL,
    uf CHAR(2) NOT NULL,
    cep CHAR(8) NOT NULL,
    CONSTRAINT chk_organizacoes_cep_1 CHECK (cep ~ '^[0-9]{8}$'),
    capacidade_atendimento INTEGER,
    CONSTRAINT chk_organizacoes_capacidade_atendimento_1 CHECK (capacidade_atendimento > 0),
    status_verificacao VARCHAR(12) NOT NULL DEFAULT 'PENDENTE',
    CONSTRAINT chk_organizacoes_status_verificacao_1 CHECK (status_verificacao IN ('PENDENTE', 'APROVADA', 'REPROVADA')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Referências seguras aos documentos para conferência administrativa.
CREATE TABLE documentos_organizacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id UUID NOT NULL REFERENCES organizacoes(id),
    enviado_por_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(12) NOT NULL,
    CONSTRAINT chk_documentos_organizacao_tipo_1 CHECK (tipo IN ('CNPJ', 'ALVARA', 'ESTATUTO', 'OUTRO')),
    chave_arquivo VARCHAR(500) NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trilha de aprovação ou reprovação por administrador.
CREATE TABLE analises_cadastro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id UUID NOT NULL REFERENCES organizacoes(id),
    administrador_id UUID NOT NULL REFERENCES usuarios(id),
    decisao VARCHAR(10) NOT NULL,
    CONSTRAINT chk_analises_cadastro_decisao_1 CHECK (decisao IN ('APROVADA', 'REPROVADA')),
    justificativa TEXT,
    analisado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (decisao <> 'REPROVADA' OR NULLIF(BTRIM(justificativa), '') IS NOT NULL)
);

-- Voluntários cadastrados sob responsabilidade de uma ONG, sem login obrigatório no MVP.
CREATE TABLE voluntarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ong_id UUID NOT NULL REFERENCES organizacoes(id),
    nome VARCHAR(160) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(25) NOT NULL,
    logradouro VARCHAR(180) NOT NULL,
    numero VARCHAR(15) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(120) NOT NULL,
    uf CHAR(2) NOT NULL,
    cep CHAR(8) NOT NULL,
    CONSTRAINT chk_voluntarios_cep_1 CHECK (cep ~ '^[0-9]{8}$'),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tipos padronizados utilizados nos itens, filtros e necessidades.
CREATE TABLE categorias_alimento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL UNIQUE,
    ativa BOOLEAN NOT NULL DEFAULT TRUE
);

-- Categorias e quantidades de alimento demandadas por uma ONG.
CREATE TABLE necessidades_ong (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ong_id UUID NOT NULL REFERENCES organizacoes(id),
    categoria_id UUID NOT NULL REFERENCES categorias_alimento(id),
    quantidade_desejada NUMERIC(12,3) NOT NULL,
    CONSTRAINT chk_necessidades_ong_quantidade_desejada_1 CHECK (quantidade_desejada > 0),
    unidade VARCHAR(20) NOT NULL,
    observacao TEXT,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Textos versionados, sujeitos a revisão jurídica.
CREATE TABLE termos_responsabilidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    versao VARCHAR(30) NOT NULL UNIQUE,
    titulo VARCHAR(160) NOT NULL,
    conteudo TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registro verificável de aceite individual e da organização representada.
CREATE TABLE aceites_termo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    termo_id UUID NOT NULL REFERENCES termos_responsabilidade(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    organizacao_id UUID NOT NULL REFERENCES organizacoes(id),
    aceito_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (termo_id, usuario_id, organizacao_id)
);

-- Oferta criada por um doador, com agenda de coleta e ciclo de status.
CREATE TABLE doacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doador_id UUID NOT NULL REFERENCES organizacoes(id),
    criado_por_id UUID NOT NULL REFERENCES usuarios(id),
    aceite_termo_id UUID REFERENCES aceites_termo(id),
    titulo VARCHAR(180) NOT NULL,
    descricao TEXT,
    periodo VARCHAR(10) NOT NULL DEFAULT 'OUTRO',
    CONSTRAINT chk_doacoes_periodo_1 CHECK (periodo IN ('CAFE', 'ALMOCO', 'JANTAR', 'OUTRO')),
    inicio_retirada TIMESTAMPTZ NOT NULL,
    fim_retirada TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO',
    CONSTRAINT chk_doacoes_status_1 CHECK (status IN ('RASCUNHO','DISPONIVEL','RESERVADA','RETIRADA','ENTREGUE','CANCELADA','ENCERRADA')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fim_retirada > inicio_retirada)
);

-- Alimentos e respectivas quantidades/validades em uma doação.
CREATE TABLE itens_doacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doacao_id UUID NOT NULL REFERENCES doacoes(id),
    categoria_id UUID NOT NULL REFERENCES categorias_alimento(id),
    descricao VARCHAR(200) NOT NULL,
    quantidade NUMERIC(12,3) NOT NULL,
    CONSTRAINT chk_itens_doacao_quantidade_1 CHECK (quantidade > 0),
    unidade VARCHAR(20) NOT NULL,
    validade_em TIMESTAMPTZ NOT NULL
);

-- Checklist preenchido na publicação pelo doador e no recebimento pela ONG.
CREATE TABLE triagens_doacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doacao_id UUID NOT NULL REFERENCES doacoes(id),
    organizacao_id UUID NOT NULL REFERENCES organizacoes(id),
    preenchido_por_id UUID NOT NULL REFERENCES usuarios(id),
    etapa VARCHAR(20) NOT NULL,
    CONSTRAINT chk_triagens_doacao_etapa_1 CHECK (etapa IN ('DOADOR_CADASTRO','ONG_RECEBIMENTO')),
    resultado VARCHAR(10) NOT NULL,
    CONSTRAINT chk_triagens_doacao_resultado_1 CHECK (resultado IN ('APTA','INAPTA')),
    respostas JSONB NOT NULL,
    CONSTRAINT chk_triagens_doacao_respostas_1 CHECK (jsonb_typeof(respostas) = 'object'),
    preenchido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (doacao_id, etapa)
);

-- Interesse da ONG e confirmação da reserva pelo doador.
CREATE TABLE solicitacoes_doacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doacao_id UUID NOT NULL REFERENCES doacoes(id),
    ong_id UUID NOT NULL REFERENCES organizacoes(id),
    solicitado_por_id UUID NOT NULL REFERENCES usuarios(id),
    status VARCHAR(12) NOT NULL DEFAULT 'PENDENTE',
    CONSTRAINT chk_solicitacoes_doacao_status_1 CHECK (status IN ('PENDENTE','ACEITA','RECUSADA','CANCELADA')),
    observacao TEXT,
    solicitado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    respondido_em TIMESTAMPTZ
);

-- Auditoria de cada alteração de status, incluindo encerramentos automáticos.
CREATE TABLE historico_doacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doacao_id UUID NOT NULL REFERENCES doacoes(id),
    alterado_por_id UUID REFERENCES usuarios(id),
    status_anterior VARCHAR(20),
    status_novo VARCHAR(20) NOT NULL,
    observacao TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comunicados internos de aprovação, reprovação e outros eventos.
CREATE TABLE notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(35) NOT NULL,
    titulo VARCHAR(160) NOT NULL,
    mensagem TEXT NOT NULL,
    lida_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices de filtro e integridade para transicoes concorrentes.
CREATE UNIQUE INDEX uq_usuarios_email_ci ON usuarios (LOWER(email));
CREATE INDEX idx_organizacoes_tipo_status ON organizacoes (tipo, status_verificacao);
CREATE INDEX idx_documentos_organizacao ON documentos_organizacao (organizacao_id);
CREATE INDEX idx_analises_cadastro_org ON analises_cadastro (organizacao_id, analisado_em DESC);
CREATE INDEX idx_voluntarios_ong ON voluntarios (ong_id);
CREATE INDEX idx_necessidades_ong_categoria ON necessidades_ong (ong_id, categoria_id) WHERE ativa = TRUE;
CREATE INDEX idx_necessidades_categoria ON necessidades_ong (categoria_id) WHERE ativa = TRUE;
CREATE INDEX idx_doacoes_busca ON doacoes (status, inicio_retirada, fim_retirada);
CREATE INDEX idx_itens_categoria_validade ON itens_doacao (categoria_id, validade_em);
CREATE INDEX idx_itens_quantidade ON itens_doacao (quantidade);
CREATE INDEX idx_triagens_doacao_etapa ON triagens_doacao (doacao_id, etapa);
CREATE INDEX idx_solicitacoes_ong_status ON solicitacoes_doacao (ong_id, status);
CREATE UNIQUE INDEX uq_aceite_por_doacao ON solicitacoes_doacao (doacao_id) WHERE status = 'ACEITA';
CREATE UNIQUE INDEX uq_solicitacao_ong_ativa ON solicitacoes_doacao (doacao_id, ong_id) WHERE status IN ('PENDENTE', 'ACEITA');
CREATE INDEX idx_historico_doacao_data ON historico_doacao (doacao_id, criado_em DESC);
CREATE INDEX idx_notificacoes_usuario_leitura ON notificacoes (usuario_id, lida_em);

-- IMPORTANTE: regras que exigem tabelas relacionadas/horario atual
-- devem ser validadas pelo backend Python em transacoes PostgreSQL:
-- 1. organizacao ONG/DOADOR conforme FK e somente APROVADA pode atuar;
-- 2. nao publicar sem termo ativo aceito, triagem apta e pelo menos um item valido;
-- 3. validade_em deve ser futura no cadastro/publicacao;
-- 4. apenas um pedido ACEITO por doacao (indice parcial garante);
-- 5. expiracao automatica deve ser executada por processo agendado;
-- 6. ao receber, exigir checklist da ONG antes de confirmar ENTREGUE.
-- 7. aplicar controle transacional nas transicoes de status.
