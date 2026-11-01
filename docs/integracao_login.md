# Contrato de autenticação — Integração React / FastAPI

**Etapa atual:** somente login por e-mail/senha com JWT, persistido no PostgreSQL. Login Google (HU01), cadastro de ONGs e doadores (HU02/HU04), recuperação de senha e doações ainda não fazem parte do backend.

## Endpoints

### `POST /api/auth/login`

Requisição JSON:

```json
{"email":"doador@demo.com","senha":"Teste@123"}
```

Resposta de sucesso (200; IDs e token são ilustrativos):

```json
{
  "access_token": "JWT_ASSINADO_GERADO_PELO_BACKEND",
  "token_type": "bearer",
  "expires_in": 3600,
  "usuario": {
    "id": "UUID_DA_ORGANIZACAO",
    "usuario_id": "UUID_DA_CONTA",
    "nome": "Padaria Conectada",
    "email": "doador@demo.com",
    "responsavel": "Carlos Silva",
    "tipo": "DOADOR",
    "perfil": "EMPRESA",
    "status": "APROVADA",
    "papel_sistema": "USUARIO"
  }
}
```

O campo `id` corresponde à organização quando vinculada, para manter a compatibilidade de tela com os dados demonstrativos existentes; `usuario_id` identifica a conta de autenticação. O backend nunca aceita `tipo`, `papel_sistema` ou `status` fornecidos no login; deriva esses valores do banco. Se não houver organização, o tipo é `SEM_ORGANIZACAO` e o status é `PENDENTE`.

Erros esperados: `401` em e-mail/senha incorretos, usuário desativado ou sem credencial local; `422` em entrada malformada ou e-mail inválido.

### `GET /api/auth/me`

Requer cabeçalho:

```text
Authorization: Bearer <access_token>
```

Retorna 200 com o objeto `usuario` acima. Retorna 401 se o token estiver ausente, alterado, expirado, ou se a conta tiver sido desativada ou excluída.

### `GET /health` e `GET /health/ready`

`/health` confirma processo em execução; `/health/ready` verifica banco PostgreSQL. Swagger: `http://localhost:8000/docs`.

## Modo de login no React

O arquivo `frontend/src/services/auth.js` implementa login/consulta de sessão via `fetch` e token em `sessionStorage`. `frontend/src/App.jsx` seleciona a API conforme a flag **de build** `VITE_AUTH_MODE=api`. O Compose completo já fornece essa flag. Para usar `npm run dev`, defina em `frontend/.env.local`:

```env
VITE_AUTH_MODE=api
VITE_API_URL=http://localhost:8000
```

O `docker-compose.frontend.yml` anterior continua iniciando a interface inteiramente simulada. Somente a autenticação foi integrada à API; a navegação de doações e os formulários restantes permanecem locais e **não podem ser considerados dados reais ou protegidos**.

O botão original "Entrar com Google (mock)" é identificado como acesso a doador de teste quando em modo API, porque esta etapa não possui OAuth Google. A tela de demonstração utiliza a senha ilustrativa `Teste@123` gravada no protótipo. Se mudar `DEMO_PASSWORD`, o login manual continua funcionando, mas os atalhos de acesso demonstrativo precisarão ser alinhados com o time de frontend.

## SQL e Docker

Na primeira criação do banco, o container `db` executa primeiro `database/schema_postgresql.sql` e em seguida `database/002_credenciais_locais.sql`. O segundo script torna `google_sub` opcional e cria `credenciais_locais` com o hash da senha. No login nunca há inserção de novas contas; o comando de inicialização do backend só cria **duas contas fictícias de teste** se `SEED_DEMO_USERS=true` e `APP_ENV=development`.

Em bancos já existentes (volume do Docker já inicializado), aplique `database/002_credenciais_locais.sql` **manualmente**, após fazer backup, pois os scripts de inicialização do PostgreSQL não rodam novamente em volumes com dados.

Para consultar o banco no VS Code usando SQLTools, configure host `localhost`, porta `5432` (ou `POSTGRES_PORT`), nome/usuário/senha do seu `.env`.

## Próximas entregas

- HU01: login Google real — fluxo OAuth ou Google Identity Services com verificação do token Google no backend.
- HU02/HU04: cadastro doador e ONG, sempre `PENDENTE` e com validações CNPJ/documentos.
- HU05: aprovação administrativa, trilha de auditoria e autorização por organização.
- Segurança pré-produção: TLS/HTTPS, rate limiting por IP e conta, proteção contra XSS, gestão/revogação de sessão e política de segredos.
