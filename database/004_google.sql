-- Desafios OIDC de uso único. Preserva contas, credenciais e perfis existentes.
BEGIN;
LOCK TABLE schema_migrations IN EXCLUSIVE MODE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE versao = '004_google') THEN
        CREATE TABLE desafios_google (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nonce_hash VARCHAR(64) NOT NULL UNIQUE,
            finalidade VARCHAR(10) NOT NULL,
            usuario_id UUID REFERENCES usuarios(id),
            expira_em TIMESTAMPTZ NOT NULL,
            consumido_em TIMESTAMPTZ,
            CONSTRAINT chk_desafio_google_finalidade CHECK (finalidade IN ('LOGIN', 'VINCULAR')),
            CONSTRAINT chk_desafio_google_usuario CHECK (
                (finalidade = 'LOGIN' AND usuario_id IS NULL) OR
                (finalidade = 'VINCULAR' AND usuario_id IS NOT NULL)
            )
        );
        CREATE INDEX ix_desafios_google_expira_em ON desafios_google (expira_em);
        INSERT INTO schema_migrations (versao) VALUES ('004_google');
    END IF;
END $$;
COMMIT;
