# Contrato de autenticação — Integração React / FastAPI

**Etapa atual:** login/cadastro local e autenticação/vinculação Google no backend. Consulte [cadastro](cadastro_real.md) e [Google](integracao_google.md). Aprovação, recuperação de senha e doações continuam pendentes. O React integra login, cadastro, Google, vinculação e conclusão de perfil.

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
    "papel_sistema": "USUARIO",
    "cadastro_completo": true,
    "google_vinculado": false
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

O `docker-compose.frontend.yml` inicia somente a interface, em modo API por padrão. Para simular sem backend, use `VITE_AUTH_MODE=mock`. Doações e reservas permanecem locais.

No modo API, o botão oficial Google usa GIS e os endpoints reais. Atalhos mock ficam restritos ao modo mock. Contas demo do servidor usam login manual com `DEMO_PASSWORD` e seed habilitado.

## SQL e Docker

Na primeira criação do banco, o container `db` executa baseline e migrations 002, 003 e 004, nessa ordem. A 002 cria credenciais locais; a 003 habilita CNPJ alfanumérico e PF; a 004 cria desafios Google. O login local não insere contas: elas são criadas pelo cadastro, primeiro acesso Google ou seed opcional de desenvolvimento.

Em bancos existentes, aplique somente as migrations pendentes, após backup, conforme [database/README.md](../database/README.md). Os scripts de inicialização não rodam novamente em volumes com dados.

Para consultar o banco no VS Code usando SQLTools, configure host `localhost`, porta `5432` (ou `POSTGRES_PORT`), nome/usuário/senha do seu `.env`.

## Cadastro e migração

`POST /api/auth/cadastro` retorna `201` no mesmo formato do login. `perfil` também pode ser `PESSOA_FISICA`; nesse caso, `id` identifica o perfil em `doadores_pessoa_fisica`. O contrato antigo de login para organizações é preservado. Para proteger senhas/documentos, respostas `422` omitem o payload recebido e mantêm apenas `loc`, `msg` e `type` por erro.

O Compose aplica migrations até 004 em volumes novos. Em volumes existentes, aplique as pendentes conforme [database/README.md](../database/README.md). A integração React dos novos endpoints está implementada.

## Próximas entregas

- HU01: configurar o Client ID do projeto e validar o fluxo real; backend e GIS no React estão implementados.
- HU02/HU04: completar o fluxo documental e registrar aceite; cadastro real e React já estão implementados.
- HU05: aprovação administrativa, trilha de auditoria e autorização por organização.
- Segurança pré-produção: TLS/HTTPS, rate limiting por IP e conta, proteção contra XSS, gestão/revogação de sessão e política de segredos.

## Sessão expirada

Ao receber 401 em operação autenticada, o frontend limpa JWT e usuário, retorna a `/entrar` e informa a expiração. Na inicialização, `/me` com 401 retorna sessão ausente sem erro fatal. Falhas de rede/servidor preservam a sessão. Erros de senha, token ou desafio na vinculação Google não encerram uma sessão local válida. Sair limpa a sessão no navegador; não há revogação do JWT no servidor.
