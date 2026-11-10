# Prato Conectado — Frontend React

O React integra login por senha, cadastro de ONG/empresa/pessoa física, primeiro acesso Google, conclusão de perfil e vinculação explícita. Doações, reservas e indicadores são demonstrações locais. Aprovação administrativa e recuperação de senha real ainda não estão implementadas.

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

Em `.env.local`, use `VITE_AUTH_MODE=api`, `VITE_API_URL=http://localhost:8000` e `VITE_GOOGLE_CLIENT_ID` igual ao Client ID do backend. O backend precisa estar acessível.

## Demonstração sem backend

Use `VITE_AUTH_MODE=mock` no `.env.local` para Vite. Para o Compose separado, na raiz:

```powershell
$env:VITE_AUTH_MODE = 'mock'
docker compose -f docker-compose.frontend.yml up --build -d
Remove-Item Env:VITE_AUTH_MODE
```

O Compose separado inicia somente o frontend, em modo API por padrão. Não execute os dois Composes na mesma porta ao mesmo tempo. Os dados mock ficam no `localStorage`, isolados por navegador/origem. As contas mock são `doador@demo.com` e `ong@demo.com`, com senha demonstrativa `Teste@123`.

No modo API, contas demonstrativas só existem se o backend habilitou o seed; entre manualmente com a senha `DEMO_PASSWORD`. Atalhos mock não autenticam na API.

## Navegação e sessão

- Conta Google sem perfil: completar cadastro.
- Cadastro completo e `PENDENTE`: aguardar análise; permite consultar situação e vincular Google.
- `REPROVADA`: tela de reprovação.
- `APROVADA`: painel com operações de doação ainda simuladas.
- JWT expirado/inválido: limpar sessão e voltar ao login com aviso, inclusive após recarregar.
- Falha de rede/servidor na consulta inicial: preservar sessão e oferecer nova tentativa.
- Erro de senha/desafio/token Google durante vinculação: preservar a sessão local válida.

JWT da aplicação fica no `sessionStorage`; ID token Google não é persistido. Logout local não revoga o JWT no servidor.

## Estrutura

- `src/App.jsx`: navegação e estado de autenticação.
- `src/components/AuthScreens.jsx`: login, cadastro, perfil, pendência e vinculação.
- `src/components/GoogleIdentityButton.jsx`: botão oficial GIS e desafios.
- `src/services/auth.js`: chamadas reais, JWT e tratamento de erros.
- `src/components/Workspace.jsx` e `src/mock/store.js`: demonstração de doações.
- `src/pages/CadastroDoador.jsx` e `src/services/organizacoes.js`: protótipo legado fora da navegação atual. O serviço não faz chamadas HTTP; somente simula com `VITE_MOCK_CADASTRO=true`. Novas integrações devem usar `/api/auth/cadastro`.

## Verificação

```powershell
npm run test
npm run lint
npm run build
```

Veja [integração frontend](INTEGRACAO_AUTH_FRONTEND.md), [contrato Google](../docs/integracao_google.md) e [roteiro de validação](../docs/validacao_autenticacao.md). Use dados fictícios nos testes locais. Não versione `.env` ou `.env.local`.
