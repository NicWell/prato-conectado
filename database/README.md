# Banco e migrations SQL

A aplicação não executa `create_all()` em produção. Ordem de aplicação:

1. `schema_postgresql.sql`: baseline histórico, 15 tabelas.
2. `002_credenciais_locais.sql`: credenciais locais e `google_sub` opcional.
3. `003_cadastro_real.sql`: CNPJ alfanumérico e perfil de doador pessoa física.
4. `004_google.sql`: desafios Google de uso único, com validade de cinco minutos.

Resultado: 17 tabelas de domínio, `desafios_google` e `schema_migrations` (19 no total). As migrations 003/004 são transacionais, registram suas versões e permitem reexecução. Os scripts anteriores são legados, sem esse controle. Não reaplicar o baseline em banco existente nem editar scripts históricos para atualizar volumes.

## Volume novo

O Compose monta os quatro scripts em `/docker-entrypoint-initdb.d`, na ordem correta. Só executam automaticamente se o diretório de dados estiver vazio.

## Volume existente

Faça backup e confirme as migrations pendentes. Se já houver 003 aplicada, execute somente 004 antes de iniciar o backend atualizado. Caso contrário, execute 003 e depois 004 (com 002 como pré-requisito). Não removem contas, credenciais ou perfis existentes.

Exemplo PowerShell para 004 na raiz, serviço `db` em execução (003 já aplicada):

```powershell
docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/prato-antes-004.dump'
docker compose cp db:/tmp/prato-antes-004.dump ./prato-antes-004.dump
# Guarde o backup em local privado, fora do Git.
docker compose cp ./database/004_google.sql db:/tmp/004_google.sql
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/004_google.sql'
```

Se falhar, a transação é revertida. Após sucesso, não há downgrade automático: remover a tabela PF descartaria cadastros. Correções devem usar uma nova migration. Alembic ainda não foi introduzido; o versionamento atual usa SQL numerado, com controle a partir de 003. Não remova volumes para aplicar migrations.

## Integridade

O banco garante e-mail único sem diferenciar maiúsculas/minúsculas, CNPJ único e CPF único em seus respectivos perfis. A migration aceita CNPJ normalizado com 12 posições `[A-Z0-9]` e dois dígitos. A API valida dígitos verificadores e regras por perfil. Documentos fictícios das contas demo legadas são preservados.

O cadastro público cria um perfil por conta nova. O modelo institucional histórico admite várias organizações por responsável; não foi restringido para evitar incompatibilidade com dados anteriores. Não existe endpoint para associar perfis adicionais.
