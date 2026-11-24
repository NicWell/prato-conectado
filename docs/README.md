# Prato Conectado — Documentação e diagramas (v1.1)

O repositório contém FastAPI, React, PostgreSQL e Docker Compose. A API integra autenticação, cadastro, aprovação administrativa e operações de doação. A planilha histórica de aceite não está no repositório.

Consulte os contratos de [cadastro](cadastro_real.md), [login](integracao_login.md), [Google](integracao_google.md) e [doações](../backend/README.md). Para preparar o ambiente, veja [migrations](../database/README.md), [frontend](../frontend/README.md) e [validação da autenticação](validacao_autenticacao.md).

## Ponto de partida — 24/11/2026

- A `main` remota está no merge do PR #13 (`16c8b12`). Os PRs anteriores entregaram login por senha, cadastro de ONG e doador (empresa ou pessoa física), integração Google, tratamento de sessão e painel administrativo com aprovação, reprovação justificada e notificação interna.
- O PR #13 integrou publicação de doações e reservas ao React e ao PostgreSQL. Doadores aprovados publicam com termo versionado e checklist. ONGs aprovadas reservam. A reserva é exclusiva e pode ocorrer antes da janela.
- Na branch `feat/fluxo-doacao-sem-mock`, as mudanças ainda estão na árvore de trabalho local. Foram adicionados cancelamento pelo doador, retirada pela ONG da reserva, recebimento com checklist e encerramento automático. O React usa sempre a API para autenticação, cadastro e doações. O armazenamento simulado e o protótipo antigo de cadastro foram removidos. O seed de contas de teste no PostgreSQL continua opcional e vem desabilitado na configuração de exemplo.
- A nova implementação passou em 109 testes de backend com PostgreSQL isolado e 23 testes de frontend, além de lint e build. O Compose local subiu saudável e as novas rotas responderam. Das quatro doações previamente registradas, duas foram encerradas por prazo e duas continuaram reservadas na checagem. O percurso completo pela interface ainda precisa de validação manual. O aceite acadêmico depende de validação com a equipe.

## Próximas entregas

1. Validar no navegador, com sessões separadas de doador e ONG, publicação, reserva, retirada, checklist e recebimento com status persistido após recarregar. Testar também cancelamento de oferta disponível e entrega pelo doador.
2. HU08 — cadastrar, editar e desativar necessidades da ONG. Completar filtros de ofertas por categoria, quantidade com unidade compatível e validade.
3. HU05 — implementar envio privado e revisão de documentos no painel administrativo.
4. HU03 — cadastrar voluntários com vínculo a uma ONG existente.

A validação com uma conta Google real depende de Client ID e origem autorizada (HU01). A recuperação de senha pela API segue pendente.

## Acesso rápido

| Arquivo | Objetivo |
|---|---|
| [`diagramas/diagrama_classes.md`](diagramas/diagrama_classes.md) | Diagrama UML conceitual editável no VS Code |
| [`diagramas/diagrama_banco.md`](diagramas/diagrama_banco.md) | Diagrama entidade-relacionamento (Mermaid) |
| [`banco/modelo_banco.dbml`](banco/modelo_banco.dbml) | Modelo relacional DBML editável / importável |
| [`../database/schema_postgresql.sql`](../database/schema_postgresql.sql) | Baseline histórico; aplicar também migrations 002–006 |
| [`banco/dicionario_dados.md`](banco/dicionario_dados.md) | Tabelas, colunas e tipos exatos |
| [`requisitos_e_rastreabilidade.md`](requisitos_e_rastreabilidade.md) | Vinculação de cada HU com tabelas e critérios de aceite |
| [`regras_de_negocio.md`](regras_de_negocio.md) | Validações de domínio e questões pendentes |
| [`diagramas/fluxo_status.md`](diagramas/fluxo_status.md) | Estados propostos das doações |

## Como visualizar no Visual Studio Code

1. Extraia a pasta e abra-a no **VS Code** por **Arquivo → Abrir Pasta**.
2. Abra `diagramas/diagrama_classes.md` ou `diagramas/diagrama_banco.md`.
3. Pressione **Ctrl+Shift+V** (pré-visualização de Markdown). Diagramas `mermaid` são renderizados pelo preview nativo de versões modernas do VS Code.
4. Para editar rapidamente os diagramas, altere o bloco entre ` ```mermaid ` e ` ``` ` no respectivo `.md` e salve. As fontes `.mmd` também estão disponíveis.
5. O arquivo `.dbml` pode ser aberto como texto no VS Code e visualizado com uma extensão específica para DBML, ou importado em um visualizador DBML compatível (por exemplo, dbdiagram.io). Não é necessário para visualizar os arquivos `.md`.

## PostgreSQL — executar o esquema inicial

Crie uma base de dados vazia chamada `prato_conectado`, conecte um usuário com privilégio de criação e execute o SQL:

```bash
createdb -U postgres prato_conectado
psql -U postgres -d prato_conectado -f database/schema_postgresql.sql
psql -U postgres -d prato_conectado -f database/002_credenciais_locais.sql
psql -U postgres -d prato_conectado -f database/003_cadastro_real.sql
psql -U postgres -d prato_conectado -f database/004_google.sql
psql -U postgres -d prato_conectado -f database/005_painel_administrativo.sql
psql -U postgres -d prato_conectado -f database/006_publicacao_reserva.sql
```

Execute esses comandos na raiz e somente em banco vazio. Para banco existente, siga [migrations e backup](../database/README.md). Não é necessário criar banco para visualizar diagramas.

Este DDL cria tabelas, chaves, índices e verificações locais. **Não implementa lógica de aplicação** (OAuth Google, agendamento da expiração, aprovação automática, aceitação de termo ou regras de validação entre tabelas). O SQL usa `gen_random_uuid()`, disponível diretamente no PostgreSQL 13 ou superior, sem exigir a criação de extensão.

## Escopo arquitetural

- Backend atual: Python / FastAPI com SQLAlchemy; migrations SQL numeradas, sem Alembic.
- Banco: PostgreSQL.
- Frontend atual: React/Vite integrado à API para autenticação, cadastro e doações.
- Infraestrutura atual: Docker Compose, PostgreSQL, Uvicorn e Nginx.
- Entidades fundamentais: usuário, organização (doador/ONG), voluntário, documento, análise, categoria, necessidade da ONG, termo, aceite, doação, item, triagem, solicitação, histórico e notificação.

**Observação de modelagem:** a estrutura atende o backlog como **proposta inicial**, não como esquema já aprovado para produção. As decisões conflitantes entre briefing e backlog estão documentadas em `regras_de_negocio.md`.
