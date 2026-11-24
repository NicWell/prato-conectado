BEGIN;
LOCK TABLE schema_migrations IN EXCLUSIVE MODE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE versao = '006_publicacao_reserva') THEN
        ALTER TABLE doacoes ALTER COLUMN doador_id DROP NOT NULL,
            ADD COLUMN doador_pf_id UUID REFERENCES doadores_pessoa_fisica(id),
            ADD CONSTRAINT chk_doacao_doador CHECK (num_nonnulls(doador_id, doador_pf_id) = 1),
            ADD COLUMN modalidade VARCHAR(8) NOT NULL DEFAULT 'RETIRADA'
                CHECK (modalidade IN ('RETIRADA', 'ENTREGA'));

        ALTER TABLE aceites_termo ALTER COLUMN organizacao_id DROP NOT NULL,
            ADD COLUMN doador_pf_id UUID REFERENCES doadores_pessoa_fisica(id),
            ADD CONSTRAINT chk_aceite_titular CHECK (num_nonnulls(organizacao_id, doador_pf_id) = 1);
        CREATE UNIQUE INDEX uq_aceite_termo_pf ON aceites_termo (termo_id, usuario_id, doador_pf_id);

        ALTER TABLE triagens_doacao ALTER COLUMN organizacao_id DROP NOT NULL,
            ADD COLUMN doador_pf_id UUID REFERENCES doadores_pessoa_fisica(id),
            ADD CONSTRAINT chk_triagem_titular CHECK (
                num_nonnulls(organizacao_id, doador_pf_id) = 1
                AND (doador_pf_id IS NULL OR etapa = 'DOADOR_CADASTRO')
            );
        CREATE INDEX idx_doacoes_doador_pf ON doacoes (doador_pf_id);

        INSERT INTO categorias_alimento (nome) VALUES
            ('Refeições prontas'), ('Frutas e verduras'), ('Pães e massas'),
            ('Laticínios'), ('Não perecíveis'), ('Outros')
            ON CONFLICT (nome) DO NOTHING;

        IF NOT EXISTS (SELECT 1 FROM termos_responsabilidade WHERE ativo) THEN
            INSERT INTO termos_responsabilidade (versao, titulo, conteudo, ativo)
            VALUES ('piloto-1', 'Termo de responsabilidade — versão provisória',
                    'O doador declara que as informações fornecidas são verdadeiras e que os alimentos estão próprios para consumo, conservados adequadamente e dentro da validade.',
                    TRUE)
            ON CONFLICT (versao) DO NOTHING;
        END IF;

        INSERT INTO schema_migrations (versao) VALUES ('006_publicacao_reserva');
    END IF;
END $$;
COMMIT;
