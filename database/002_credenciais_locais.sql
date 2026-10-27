-- Extensão incremental do esquema existente para autenticação por e-mail e senha.
-- A HU01 (login Google) poderá manter google_sub preenchido quando for implementada.
-- Executar APÓS schema_postgresql.sql, uma vez que ele cria usuarios.
ALTER TABLE usuarios ALTER COLUMN google_sub DROP NOT NULL;

CREATE TABLE IF NOT EXISTS credenciais_locais (
    usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    senha_hash VARCHAR(255) NOT NULL,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE credenciais_locais IS
    'Credenciais de senha local; nao armazenar senhas em texto puro.';
