# Validação de autenticação e cadastro

Escopo: login local, cadastro, sessão expirada, primeiro acesso Google e vinculação. Aprovação administrativa (HU05) permanece fora desta etapa.

## Preparação

1. Configurar `.env` sem versionar segredos e aplicar migrations pendentes conforme [database/README.md](../database/README.md). Não remover volumes existentes.
2. Executar `docker compose up --build -d` e conferir `docker compose ps`.
3. Abrir http://localhost:5173 e http://localhost:8000/docs. Confirmar que os serviços estão saudáveis.
4. Para Google, configurar `GOOGLE_CLIENT_ID` e origem JavaScript `http://localhost:5173` no Google Cloud. O Compose repassa o identificador ao frontend; Vite local exige `VITE_GOOGLE_CLIENT_ID` no `.env.local`. Alterações exigem novo build.

## Cadastro e login local

- Cadastrar ONG com CNPJ válido, capacidade positiva, contato e endereço completo: resposta 201 e tela PENDENTE.
- Repetir para doador empresa e pessoa física (CPF), usando documentos fictícios distintos.
- Tentar documento inválido, e-mail/documento duplicado, senha curta e capacidade inválida: erros exibidos sem criar cadastro parcial.
- Sair, entrar com a conta criada e recarregar: mesma conta e status via `/api/auth/me`.
- Tentar senha incorreta: acesso recusado. Contas novas permanecem pendentes; ainda não existe painel de aprovação.

## Sessão e indisponibilidade

- Com uma conta de teste autenticada, em DevTools > Armazenamento, trocar `prato_conectado_api_access_token` no sessionStorage por `token-invalido`; recarregar: limpar token/usuário, voltar ao login e exibir aviso, sem erro fatal.
- Repetir durante a sessão, antes de Consultar situação: mesmo retorno ao login.
- Simular modo offline no navegador e recarregar com sessão válida: mostrar falha com Tentar novamente, mantendo token. Voltar online e tentar novamente.
- Sair não deve exibir aviso de expiração.

## Google real (interação do titular da conta)

1. Conta Google ainda não cadastrada: clicar no botão oficial, concluir seleção/consentimento, verificar formulário de perfil; completar com documento fictício válido e endereço; resultado PENDENTE.
2. Sair e entrar novamente com Google: reconhecer a mesma conta e preservar perfil.
3. Conta local com o mesmo e-mail Google, ainda sem vínculo: tentativa Google deve orientar entrar com senha e vincular, sem união automática.
4. Entrar com senha, Vincular minha conta Google, confirmar senha e selecionar o mesmo e-mail: vínculo concluído; ambos os métodos devem autenticar a mesma conta.
5. Senha incorreta, conta Google diferente e token/desafio inválido: exibir erro sem apagar sessão local válida. Repetir com novo desafio quando necessário.

Não considerar um desafio HTTP ou teste com certificado local como comprovação do consentimento real. Não registrar JWT, ID token, senha ou documento pessoal em evidências compartilhadas.

## Testes automatizados

Frontend: `npm run test`, `npm run lint`, `npm run build` em `frontend/`.
Backend: `python -m pytest -q` em `backend/`, com dependências de desenvolvimento. Sem `TEST_DATABASE_URL`, usa SQLite isolado e pula testes exclusivos de PostgreSQL. Para estes últimos, usar banco PostgreSQL descartável conforme [backend/README.md](../backend/README.md).

## Evidências da execução em 10/11/2026

- Docker reconstruído; backend, frontend e banco saudáveis. Bundle servido contém cadastro, perfil, Google e tratamento de sessão expirada.
- Frontend: 22 testes aprovados, lint e build aprovados. Regressões cobrem 401 na restauração, cache sem JWT, operação sem JWT, preservação em falhas de rede/503 e erro de senha Google.
- Backend: 85 testes aprovados em PostgreSQL 17 descartável, incluindo migrations e concorrência, sem testes pulados. Um aviso de depreciação do transporte de testes httpx/Starlette; sem falhas.
- HTTP contra a API local: cadastro 201 de empresa, pessoa física e ONG; PENDENTE e perfil completo; login e `/me` 200; duplicidade de e-mail/documento 409; senha e JWT inválidos 401.
- Google pela API local: desafio 201; ID token falso recusado com 401; vinculação sem JWT recusada com 401. Casos criptográficos, perfil e vinculação cobertos pela suíte backend com certificados de teste.
- JWT assinado e expirado recusado com 401; preflight CORS de cadastro autorizado para `http://localhost:5173`; Client ID Google compilado no frontend igual ao configurado no backend, sem registrar seu valor.
- Três cadastros fictícios PENDENTES foram adicionados ao banco local na validação HTTP. Nenhum registro existente foi removido.
- Validação visual e consentimento Google real ainda não comprovados: acesso automatizado ao Firefox bloqueado por falta de suporte à política de URLs. O titular deve executar o roteiro Google acima e registrar o resultado, sem expor credenciais.
