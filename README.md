# Prato Conectado

Monorepositório: `frontend/` (React/Vite), `backend/` (FastAPI), `database/` (PostgreSQL), `docs/` (modelagem).

## Etapa implementada: login API

- Login de **e-mail/senha** via `POST /api/auth/login`, JWT e consulta `/api/auth/me`.
- PostgreSQL persiste usuários e hashes Argon2id; script incremental ajusta o modelo de login Google documentado.
- `docker-compose.yml` inicia **db + backend + frontend**; `docker-compose.frontend.yml` mantém o modo mock independente da equipe.
- **Google OAuth (HU01), cadastro de ONGs/doadores, aprovação, recuperação de senha e doações NÃO estão implementados no backend.** O restante das telas React permanece demonstrativo/local.

## Iniciar no Windows (PowerShell)

```powershell
Copy-Item .env.example .env
# Edite .env: substitua JWT_SECRET_KEY e POSTGRES_PASSWORD por valores seguros.
# Para gerar uma chave JWT:
python -c "import secrets; print(secrets.token_urlsafe(48))"
docker compose up --build -d
docker compose ps
```

- Frontend: http://localhost:5173
- Swagger: http://localhost:8000/docs
- Endpoint de login: http://localhost:8000/api/auth/login
- PostgreSQL: `localhost:5432` (somente interface local para VS Code/SQLTools)
- Contas de desenvolvimento (se `SEED_DEMO_USERS=true`): `doador@demo.com` ou `ong@demo.com`, senha configurada em `DEMO_PASSWORD`.

### Conferir o login no Swagger

1. Abra `http://localhost:8000/docs`.
2. Execute `POST /api/auth/login` com `{"email":"doador@demo.com","senha":"Teste@123"}` (ou a senha definida no `.env`).
3. Copie o campo `access_token`, pressione **Authorize** no Swagger, informe o token e chame `GET /api/auth/me`.
4. Entre no frontend com a mesma conta e confira o redirecionamento para a área demonstrativa.

**Importante:** o login do React utiliza a API apenas quando compilado com `VITE_AUTH_MODE=api`; o `docker-compose.yml` já configura isso. Quem executar o `docker-compose.frontend.yml` continua com a simulação antiga, sem backend. Para `npm run dev`, configure `frontend/.env.local` com `VITE_AUTH_MODE=api` e `VITE_API_URL=http://localhost:8000`.

O botão chamado Google no protótipo era **mock**; no modo API foi reidentificado como acesso demonstrativo de doador. Não use contas demo em produção.

### Parar sem excluir os dados

```powershell
docker compose down
```

Somente em um ambiente de **teste descartável**: `docker compose down -v` também apaga completamente o banco de dados.

Veja `backend/README.md` para testes, limitações e comandos da API.
