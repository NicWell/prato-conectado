-- Aplicar após 001 (schema_postgresql.sql) e 002. Não remove registros.
-- Transação: em caso de falha, nenhuma alteração desta migration é aplicada.
BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (
    versao VARCHAR(80) PRIMARY KEY,
    aplicada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
    -- Serializa aplicações simultâneas desta migration.
    LOCK TABLE schema_migrations IN EXCLUSIVE MODE;
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE versao = '003_cadastro_real') THEN
        ALTER TABLE organizacoes DROP CONSTRAINT chk_organizacoes_cnpj_1;
        ALTER TABLE organizacoes ADD CONSTRAINT chk_organizacoes_cnpj_1
            CHECK (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$');

        CREATE TABLE doadores_pessoa_fisica (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            usuario_responsavel_id UUID NOT NULL UNIQUE REFERENCES usuarios(id),
            nome VARCHAR(180) NOT NULL,
            cpf VARCHAR(11) NOT NULL UNIQUE CHECK (cpf ~ '^[0-9]{11}$'),
            email_contato VARCHAR(255) NOT NULL,
            telefone VARCHAR(25) NOT NULL,
            logradouro VARCHAR(180) NOT NULL,
            numero VARCHAR(15) NOT NULL,
            complemento VARCHAR(120),
            bairro VARCHAR(100) NOT NULL,
            cidade VARCHAR(120) NOT NULL,
            uf VARCHAR(2) NOT NULL,
            cep VARCHAR(8) NOT NULL CHECK (cep ~ '^[0-9]{8}$'),
            status_verificacao VARCHAR(12) NOT NULL DEFAULT 'PENDENTE',
            CONSTRAINT chk_doador_pf_status CHECK (status_verificacao IN ('PENDENTE','APROVADA','REPROVADA')),
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        INSERT INTO schema_migrations (versao) VALUES ('003_cadastro_real');
    END IF;
END $$;
COMMIT;
