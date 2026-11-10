# Integração do frontend: autenticação, cadastro e Google

Implementação sobre a versão enviada do Prato Conectado, de acordo com `docs/cadastro_real.md`, `docs/integracao_login.md` e `docs/integracao_google.md` do backend. **Somente o frontend, arquivos de Compose e documentação foram alterados; nenhuma rota/backend foi modificada.**

## O que está integrado

- `POST /api/auth/login` — login por senha, com mensagens de erro.
- `GET /api/auth/me` — restauração/consulta de sessão, atualização do status e limpeza de sessão após 401.
- `POST /api/auth/cadastro` — cadastro de ONG, empresa e pessoa física, com CPF/CNPJ, endereço separado, contato e capacidade positiva para ONG. O backend cria `PENDENTE` e retorna o JWT.
- `POST /api/auth/google/desafio` seguido de `POST /api/auth/google` — botão oficial GIS com ID token e nonce individual por tentativa.
- `POST /api/auth/perfil` — conclusão de cadastro para primeiro acesso Google (sem enviar senha, e-mail de acesso nem responsável).
- `POST /api/auth/google/vincular/desafio` seguido de `POST /api/auth/google/vincular` — vinculação explícita do Google a uma conta com login local existente, com senha atual.
- Status de acesso: `SEM_ORGANIZACAO`/`cadastro_completo=false` → completar cadastro; `PENDENTE` → consultar aprovação; `REPROVADA` → tela específica; `APROVADA` → workspace.
- Erros HTTP 401, 409 e 422 (inclusive `detail.codigo`, `detail.mensagem` e `detail[].loc`), indisponibilidade de rede, loading e bloqueio de envios duplicados.
- Doações e reservas permanecem **simulações locais**, mesmo que o login esteja em modo API. A interface avisa isso.

## Arquivos principais

- `src/services/auth.js` — API, sessão, payloads, erros e Google.
- `src/utils/cadastro.js` — regras de validação do formulário e estados brasileiros.
- `src/components/AuthScreens.jsx` — login, cadastro, completar perfil, pendente, reprovado, vinculação e aviso de recuperação não disponível na API.
- `src/components/GoogleIdentityButton.jsx` — Google Identity Services, carregamento sob demanda e desafios com nonce.
- `src/App.jsx` — controle da navegação e das regras de acesso.
- `src/components/Workspace.jsx` — acesso à vinculação Google e simulação de doações.
- `src/index.css` — campos e botão Google, mantendo o painel vermelho e a rolagem direita.
- `tests/integracao.test.mjs` — testes de payload, validação e erros.

A página antiga `src/pages/CadastroDoador.jsx` e `services/organizacoes.js` são legado e **não devem ser utilizados para novos cadastros**. O endpoint `/api/organizacoes` do legado não existe. O fluxo atual usa `AuthScreens.jsx` e `/api/auth/cadastro`.

## 1. Executar frontend local

Na pasta `frontend`:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

No `.env.local` use:

```env
VITE_AUTH_MODE=api
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
```

`VITE_GOOGLE_CLIENT_ID` pode ficar vazio enquanto o Google Cloud não estiver configurado: login/cadastro por senha funcionarão normalmente se o backend estiver operacional.

Para testes independentes do backend, use `VITE_AUTH_MODE=mock`. A integração Google real não é oferecida nesse modo.

## 2. Executar Docker (backend + banco + frontend)

Na raiz do repositório, crie `.env` a partir de `.env.example` e configure `POSTGRES_PASSWORD` e `JWT_SECRET_KEY`. Para Google, configure também o `GOOGLE_CLIENT_ID` no mesmo arquivo:

```env
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
```

É um Client ID público, não o Client Secret. No Google Cloud habilite a origem JavaScript `http://localhost:5173`. Se o consentimento estiver em teste, libere as contas de teste. Em banco com volume pré-existente, aplique as migrations conforme `database/README.md`, sobretudo `004_google.sql`.

```bash
docker compose up --build -d
```

Frontend em `http://localhost:5173`; documentação do backend em `http://localhost:8000/docs`.

O Compose original recebeu somente o argumento de build `VITE_GOOGLE_CLIENT_ID`. O Compose apenas do frontend (`docker-compose.frontend.yml`) também aceita variáveis `VITE_AUTH_MODE`, `VITE_API_URL` e `GOOGLE_CLIENT_ID`.

**Observação:** as variáveis `VITE_*` são incluídas na compilação do Vite. Ao mudar o Client ID, execute `docker compose up --build -d` para reconstruir a imagem. Não coloque Client Secret nem senha de serviço no Vite.

## 3. Roteiro de testes manuais

1. Cadastrar ONG: CNPJ válido (numérico ou alfanumérico), capacidade positiva, endereço e responsável; verificar status `PENDENTE`.
2. Cadastrar empresa: mesmo fluxo sem capacidade/CPF. Cadastrar pessoa física: CPF sem CNPJ.
3. Testar 409 com e-mail ou documento já cadastrado; dados do formulário não devem desaparecer.
4. Testar erros de validação 422 e backend fora do ar: campo destacado e botão reabilitado.
5. Fazer logout, entrar novamente com e-mail/senha e consultar status usando `/me`.
6. Se Google estiver configurado: entrar com conta Google inédita → completar perfil → `PENDENTE`.
7. Entrar com senha em conta local → "Vincular conta Google" → digitar senha atual → escolher **mesmo e-mail** Google → validar ambos métodos de login.
8. Tentar entrar com Google cujo e-mail já existe localmente sem vinculação: verificar 409 `VINCULACAO_NECESSARIA`.
9. Verificar Google com conta diferente, senha incorreta, desafio expirado e falha de conexão; a interface não deve autenticar indevidamente.
10. No modo API, confirmar que recuperação de senha, doações e reservas **não são apresentadas como operações reais**.
11. Testar navegação por teclado e em celular. O lado vermelho deve continuar fixo, e apenas o formulário direito deve rolar no desktop.

## 4. Testes automatizados

```bash
cd frontend
npm test
npm run lint
npm run build
```

`npm test` não requer instalação de bibliotecas externas além do Node.js. Os testes de fluxo Google real precisam do OAuth Client ID, Google Cloud e API/DB configurados; não podem ser substituídos por mock.

## Limitações e cuidados

- Não existem endpoints de aprovação administrativa, recuperação de senha real ou doações no backend desta entrega. O frontend não inventa essas rotas.
- O backend é a autoridade quanto a `status`, `papel_sistema` e demais permissões; esconder botões no React não substitui verificação na API.
- IDs: `usuario.usuario_id` identifica a conta; `usuario.id` identifica a organização ou o perfil PF. Para contas Google incompletas, `id` é temporariamente o identificador da própria conta.
- JWT da aplicação é armazenado em `sessionStorage`. O ID token Google só é utilizado na requisição de autenticação/vinculação, sem persistência no navegador.
- Não efetuar commit dos arquivos `.env`, `.env.local` ou de segredos privados.

## Git sugerido

Branch: `feat/frontend-auth-cadastro-google`

Commit: `feat(frontend): integra cadastro real, sessão e autenticação Google`
