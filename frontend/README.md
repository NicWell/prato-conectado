# Prato Conectado — Frontend React

O React integra login por senha, cadastro de ONG/empresa/pessoa física, primeiro acesso Google, conclusão de perfil e vinculação explícita. O painel administrativo e as operações de doação usam a API. A recuperação de senha segue pendente.

## Executar com backend e PostgreSQL

Na raiz, configure `.env` conforme o [README principal](../README.md) e execute:

```powershell
docker compose up --build -d
```

Frontend: http://localhost:5173. Swagger: http://localhost:8000/docs.
O Compose repassa `GOOGLE_CLIENT_ID` para `VITE_GOOGLE_CLIENT_ID` no build. Não use Client Secret no frontend.

## Executar com Vite

```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Em `.env.local`, use `VITE_API_URL=http://localhost:8000` e `VITE_GOOGLE_CLIENT_ID` igual ao Client ID do backend. O backend precisa estar acessível.

## Executar somente o frontend no Docker

```powershell
docker compose -f docker-compose.frontend.yml up --build -d
```

Esse Compose precisa de uma API acessível pelo navegador. Use outra porta caso a interface do Compose completo já esteja em execução.

## Navegação e sessão

- Conta Google sem perfil: completar cadastro.
- Cadastro completo e `PENDENTE`: aguardar análise; permite consultar situação e vincular Google.
- `REPROVADA`: tela de reprovação.
- `APROVADA`: painel com operações de doação persistidas.
- JWT expirado/inválido: limpar sessão e voltar ao login com aviso, inclusive após recarregar.
- Falha de rede/servidor na consulta inicial: preservar sessão e oferecer nova tentativa.
- Erro de senha/desafio/token Google durante vinculação: preservar a sessão local válida.

JWT da aplicação fica no `sessionStorage`; ID token Google não é persistido. Logout local não revoga o JWT no servidor.

## Estrutura

- `src/App.jsx`: navegação e estado de autenticação.
- `src/components/AuthScreens.jsx`: login, cadastro, perfil, pendência e vinculação.
- `src/components/GoogleIdentityButton.jsx`: botão oficial GIS e desafios.
- `src/services/auth.js`: chamadas reais, JWT e tratamento de erros.
- `src/components/Workspace.jsx` e `src/services/doacoes.js`: telas e integração do fluxo de doações.

## Verificação

```powershell
npm run test
npm run lint
npm run build
```

Veja [integração frontend](INTEGRACAO_AUTH_FRONTEND.md), [contrato Google](../docs/integracao_google.md) e [roteiro de validação](../docs/validacao_autenticacao.md). Use dados fictícios nos testes locais. Não versione `.env` ou `.env.local`.
