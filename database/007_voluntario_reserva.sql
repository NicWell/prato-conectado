BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE versao = '007_voluntario_reserva') THEN
        ALTER TABLE voluntarios ADD CONSTRAINT uq_voluntarios_ong_id UNIQUE (ong_id, id);
        ALTER TABLE solicitacoes_doacao ADD COLUMN voluntario_id UUID;
        ALTER TABLE solicitacoes_doacao ADD CONSTRAINT fk_reserva_voluntario_ong
            FOREIGN KEY (ong_id, voluntario_id) REFERENCES voluntarios(ong_id, id);
        INSERT INTO schema_migrations (versao) VALUES ('007_voluntario_reserva');
    END IF;
END $$;
COMMIT;
