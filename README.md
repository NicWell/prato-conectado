# Prato Conectado

Monorepositório: `frontend/` (React/Vite), `backend/` (FastAPI), `database/` (PostgreSQL), `docs/` (modelagem).

## Etapa implementada: login e cadastro API

- Login de **e-mail/senha** via `POST /api/auth/login`, JWT e consulta `/api/auth/me`.
- PostgreSQL persiste usuários e hashes Argon2id; script incremental ajusta o modelo de login Google documentado.
- `docker-compose.yml` inicia **db + backend + frontend**; `docker-compose.frontend.yml` inicia somente o frontend e aceita modo API ou mock.
- Cadastro real em `POST /api/auth/cadastro`: ONG e empresa com CNPJ numérico/alfanumérico; doador pessoa física com CPF. Conta, credencial e perfil são criados em transação, sempre `PENDENTE`.
- Login Google, vinculação explícita e conclusão de perfil estão implementados no backend e integrados ao React/GIS. Configure `GOOGLE_CLIENT_ID`, repassado ao build como `VITE_GOOGLE_CLIENT_ID`: [contrato Google](docs/integracao_google.md).
- Painel administrativo integrado à API: conta exclusiva da equipe, consulta de ONGs/doadores, aprovação e reprovação justificada, histórico e notificação interna. Veja [configuração e criação da conta](docs/painel_administrativo.md). Revisão documental ainda pendente.
- Recuperação de senha real e doações ainda não estão implementadas no backend. Doações e reservas permanecem demonstrativas/locais.
- Contrato: [cadastro real](docs/cadastro_real.md). Banco existente: aplicar as [migrations pendentes até 005](database/README.md) antes de iniciar o backend atualizado, sem remover volumes.

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

**Importante:** login e cadastro usam a API quando compilados com `VITE_AUTH_MODE=api`; os dois arquivos Compose configuram API por padrão. O Compose separado inicia somente o frontend e exige backend acessível. Para simular sem backend, defina `VITE_AUTH_MODE=mock` antes de reconstruir o Compose separado. Para `npm run dev`, configure `frontend/.env.local` com `VITE_AUTH_MODE=api`, `VITE_API_URL=http://localhost:8000` e, para Google, `VITE_GOOGLE_CLIENT_ID` igual ao backend.

No modo API, o botão oficial Google usa GIS quando configurado. Atalhos de contas mock ficam disponíveis somente no modo mock. Contas demo do servidor usam login manual com `DEMO_PASSWORD` e dependem do seed habilitado. Não use contas demo em produção.

Sessões expiradas retornam ao login com aviso. Falhas de rede preservam a sessão para nova tentativa. Veja o [roteiro de validação](docs/validacao_autenticacao.md).

### Parar sem excluir os dados

```powershell
docker compose down
```

Somente em um ambiente de **teste descartável**: `docker compose down -v` também apaga completamente o banco de dados.

Veja `backend/README.md` para testes, limitações e comandos da API.
