# Banco e migrations SQL

A aplicação não executa `create_all()` em produção. Ordem de aplicação:

1. `schema_postgresql.sql`: baseline histórico, 15 tabelas.
2. `002_credenciais_locais.sql`: credenciais locais e `google_sub` opcional.
3. `003_cadastro_real.sql`: CNPJ alfanumérico e perfil de doador pessoa física.
4. `004_google.sql`: desafios Google de uso único, com validade de cinco minutos.
5. `005_painel_administrativo.sql`: histórico para doador PF e conta administrativa única. Veja [preparação e provisionamento](../docs/painel_administrativo.md).
6. `006_publicacao_reserva.sql`: amplia a titularidade de doações, aceites e triagens para PF, adiciona a modalidade e carrega categorias e um termo provisório para o piloto.

7. `007_voluntario_reserva.sql`: permite vincular opcionalmente um voluntário da mesma ONG à reserva, preservando as reservas existentes.

Resultado: 17 tabelas de domínio, `desafios_google` e `schema_migrations` (19 no total). As migrations 003/004/005/006/007 são transacionais, registram suas versões e permitem reexecução. Os scripts anteriores são legados, sem esse controle. Não reaplicar o baseline em banco existente nem editar scripts históricos para atualizar volumes.

## Volume novo

O Compose monta os sete scripts em `/docker-entrypoint-initdb.d`, na ordem correta. Só executam automaticamente se o diretório de dados estiver vazio.

## Volume existente

Faça backup e confirme quais scripts estão pendentes. Aplique somente os pendentes, em ordem até 007, com 002 como pré-requisito. Consulte `schema_migrations` para as versões 003 em diante. Preserve o volume existente.

Exemplo PowerShell na raiz, com serviço `db` em execução e migrations até 006 já aplicadas:

```powershell
docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/prato-antes-007.dump'
docker compose cp db:/tmp/prato-antes-007.dump ./prato-antes-007.dump
# Guarde o backup em local privado, fora do Git.
docker compose cp ./database/007_voluntario_reserva.sql db:/tmp/007_voluntario_reserva.sql
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/007_voluntario_reserva.sql'
```

Se falhar, a transação é revertida. Correções após aplicação devem usar uma nova migration.

## Integridade

O banco garante e-mail único sem diferenciar maiúsculas/minúsculas, CNPJ único e CPF único em seus respectivos perfis. A migration aceita CNPJ normalizado com 12 posições `[A-Z0-9]` e dois dígitos. A API valida dígitos verificadores e regras por perfil. Documentos fictícios das contas demo legadas são preservados.

O cadastro público cria um perfil por conta nova. O modelo institucional histórico admite várias organizações por responsável; não foi restringido para evitar incompatibilidade com dados anteriores. Não existe endpoint para associar perfis adicionais.
