# Prato Conectado — Documentação e diagramas (v1.1)

O repositório contém backend FastAPI, frontend React, PostgreSQL e Docker Compose. Login/cadastro local e autenticação/vinculação Google estão implementados no backend; Google depende do Client ID e integração GIS da equipe frontend. O frontend atual integra somente o login local. Doações e aprovação continuam em modelagem. A planilha histórica de aceite não está no repositório; os registros de aceite não foram revalidados.

Contrato atual: [cadastro real](cadastro_real.md), [login](integracao_login.md), [Google](integracao_google.md), [migrations](../database/README.md). Os READMEs antigos dentro de `frontend/` descrevem o protótipo; para o estado da integração backend, use estes contratos e o README raiz.

## Acesso rápido

| Arquivo | Objetivo |
|---|---|
| [`diagramas/diagrama_classes.md`](diagramas/diagrama_classes.md) | Diagrama UML conceitual editável no VS Code |
| [`diagramas/diagrama_banco.md`](diagramas/diagrama_banco.md) | Diagrama entidade-relacionamento (Mermaid) |
| [`banco/modelo_banco.dbml`](banco/modelo_banco.dbml) | Modelo relacional DBML editável / importável |
| [`../database/schema_postgresql.sql`](../database/schema_postgresql.sql) | Baseline histórico; aplicar também migrations 002–004 |
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
```

Execute esses comandos na raiz e somente em banco vazio. Para banco existente, siga [migrations e backup](../database/README.md). Não é necessário criar banco para visualizar diagramas.

Este DDL cria tabelas, chaves, índices e verificações locais. **Não implementa lógica de aplicação** (OAuth Google, agendamento da expiração, aprovação automática, aceitação de termo ou regras de validação entre tabelas). O SQL usa `gen_random_uuid()`, disponível diretamente no PostgreSQL 13 ou superior, sem exigir a criação de extensão.

## Escopo arquitetural

- Backend atual: Python / FastAPI com SQLAlchemy; migrations SQL numeradas, sem Alembic.
- Banco: PostgreSQL.
- Frontend atual: React/Vite; autenticação API e fluxos demonstrativos locais.
- Infraestrutura atual: Docker Compose, PostgreSQL, Uvicorn e Nginx.
- Entidades fundamentais: usuário, organização (doador/ONG), voluntário, documento, análise, categoria, necessidade da ONG, termo, aceite, doação, item, triagem, solicitação, histórico e notificação.

**Observação de modelagem:** a estrutura atende o backlog como **proposta inicial**, não como esquema já aprovado para produção. As decisões conflitantes entre briefing e backlog estão documentadas em `regras_de_negocio.md`.
