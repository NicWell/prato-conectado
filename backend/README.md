# Backend de autenticação — Prato Conectado

API FastAPI para **login/cadastro local e autenticação Google**, com credenciais Argon2id no PostgreSQL e JWT (HS256, 1h por padrão). ONG/empresa usa CNPJ numérico ou alfanumérico; pessoa física usa CPF. Aprovação e doações continuam pendentes. Google exige configuração e integração frontend.

- `POST /api/auth/login` — recebe JSON `{ "email": "...", "senha": "..." }`, devolve token e perfil.
- `POST /api/auth/cadastro` — cria conta, credencial e perfil `PENDENTE` em transação; retorna `201` com token e usuário. Veja [campos e exemplos](../docs/cadastro_real.md).
- `GET /api/auth/me` — recebe `Authorization: Bearer <token>`; valida assinatura/expiração e consulta o usuário ativo no banco.
- `POST /api/auth/perfil` — conclui o perfil da conta autenticada, sem senha/e-mail/responsável no payload.
- `POST /api/auth/google/desafio` e `POST /api/auth/google` — desafio OIDC e troca do ID token Google por JWT da aplicação.
- `POST /api/auth/google/vincular/desafio` e `POST /api/auth/google/vincular` — vinculação autenticada com reconfirmação da senha local.
- `GET /health` — liveness.
- `GET /health/ready` — verifica conexão com o banco.
- `/docs` — Swagger/OpenAPI.

A credencial local foi adicionada por 002; `usuarios.google_sub` é opcional e único. A migration 004 acrescenta desafios de uso único para Google. Configure `GOOGLE_CLIENT_ID` no `.env` raiz; vazio desabilita somente Google com 503. Não há Client Secret neste fluxo. Veja [contrato, configuração e testes Google](../docs/integracao_google.md). O backend nunca une contas só pela coincidência de e-mail.

## Execução

Na raiz do repositório, copie `.env.example` para `.env`, troque obrigatoriamente `JWT_SECRET_KEY` por uma chave aleatória e `POSTGRES_PASSWORD` por senha segura, e execute:

```sh
docker compose up --build -d
docker compose ps
```

Abrir: http://localhost:5173 (frontend), http://localhost:8000/docs (API).

Somente em desenvolvimento (`APP_ENV=development` e `SEED_DEMO_USERS=true`), duas contas demonstrativas são criadas no banco com a senha definida em `DEMO_PASSWORD`:
- `doador@demo.com`
- `ong@demo.com`

Essas contas têm organização demonstrativa `APROVADA`, **sem processo administrativo real**, com CNPJs fictícios. Não habilite o seed em produção.

```sh
# Bash/Git Bash (ou utilize o Swagger em /docs)
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"doador@demo.com","senha":"Teste@123"}'
```

No PowerShell, use:

```powershell
$login = Invoke-RestMethod -Uri http://localhost:8000/api/auth/login -Method Post -ContentType 'application/json' -Body '{"email":"doador@demo.com","senha":"Teste@123"}'
Invoke-RestMethod -Uri http://localhost:8000/api/auth/me -Headers @{ Authorization = "Bearer $($login.access_token)" }
```

**Atenção**: A seed é idempotente; não sobrescreve senhas já cadastradas. Scripts em `/docker-entrypoint-initdb.d` só executam na **primeira criação de volume vazio**. Volumes existentes exigem as migrations pendentes até 004 antes de iniciar o backend. Veja [backup e aplicação](../database/README.md). Não remova volumes com dados.

### Testes automatizados

```sh
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

Sem configuração adicional, os testes usam SQLite em memória. Para validar o SQL real, defina `TEST_DATABASE_URL` com URL `postgresql+psycopg://...` de um **banco descartável e isolado**. Cada teste cria/remove um schema `teste_<uuid>` próprio e aplica os quatro scripts. A suíte cobre cadastro, validações, duplicidade, rollback e regressão do login. Testes Google assinam tokens com chave de teste e substituem somente o download dos certificados, mantendo validação criptográfica real. Não usam Client ID real nem dependem de rede. Testes exclusivos de migration/concorrência PostgreSQL são pulados em SQLite.

Models: `app/models/entities.py`; schema de cadastro: `app/schemas/cadastro.py`; transação: `app/services/cadastro.py`; rotas: `app/api/auth.py`. Os schemas antigos de login permanecem no módulo de autenticação.

## Segurança / limitações

- Token no `sessionStorage` é uma integração inicial simples; a evolução para produção deve incluir política robusta contra XSS, rate limiting, HTTPS, rotação/revogação de sessões e autenticação Google conforme HU01.
- Permissões são conferidas pelo backend nos endpoints protegidos (`/me`); **doações, cadastro e recuperação de senha no React continuam mock** e não têm validade operacional nem segurança de servidor.
- Segredos reais ficam apenas no `.env`, nunca no repositório. Evite disponibilizar contas demo publicamente.
