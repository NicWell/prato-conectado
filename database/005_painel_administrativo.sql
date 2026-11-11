-- Amplia o histórico existente para pessoa física, sem remover dados.
BEGIN;
LOCK TABLE schema_migrations IN EXCLUSIVE MODE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE versao = '005_painel_administrativo') THEN
        ALTER TABLE analises_cadastro ALTER COLUMN organizacao_id DROP NOT NULL;
        ALTER TABLE analises_cadastro ADD COLUMN doador_pf_id UUID REFERENCES doadores_pessoa_fisica(id);
        ALTER TABLE analises_cadastro ADD CONSTRAINT chk_analise_perfil CHECK (
            (organizacao_id IS NOT NULL AND doador_pf_id IS NULL) OR
            (organizacao_id IS NULL AND doador_pf_id IS NOT NULL)
        );
        CREATE INDEX idx_analises_cadastro_pf ON analises_cadastro (doador_pf_id, analisado_em DESC);
        CREATE INDEX idx_doadores_pf_status ON doadores_pessoa_fisica (status_verificacao);
        CREATE UNIQUE INDEX uq_administrador_unico ON usuarios (papel_sistema) WHERE papel_sistema = 'ADMINISTRADOR';
        INSERT INTO schema_migrations (versao) VALUES ('005_painel_administrativo');
    END IF;
END $$;
COMMIT;
