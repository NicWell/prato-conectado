# Painel administrativo

A conta exclusiva da equipe usa o login existente (`POST /api/auth/login`). O campo
`usuario.papel_sistema = ADMINISTRADOR` direciona o React para `#/admin/cadastros`,
inclusive ao restaurar a sessão. Não precisa de perfil de organização e não passa
pelo formulário de conclusão do cadastro. O modo mock não fornece acesso administrativo.

## Preparar um banco existente

Aplicar as migrations anteriores até 004 primeiro. A aplicação não executa migrations
automaticamente e os scripts de inicialização do Compose só rodam em volumes novos.
Faça backup antes de aplicar 005, sem excluir o volume:

```powershell
docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/prato-antes-005.dump'
docker compose cp db:/tmp/prato-antes-005.dump ./prato-antes-005.dump
# Guarde o backup em local privado, fora do Git.
docker compose cp ./database/005_painel_administrativo.sql db:/tmp/005_painel_administrativo.sql
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/005_painel_administrativo.sql'
docker compose up --build -d
```

005 mantém o histórico institucional, adiciona referência opcional a doador PF e exige
exatamente um dos perfis por análise. Também garante no banco que só exista uma conta
`ADMINISTRADOR`, inclusive inativa. Se houver vários administradores legados, a migration
falha e reverte integralmente; a equipe precisa resolver essa situação antes de reaplicar.

## Criar a conta da equipe

Preencha `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env` da raiz.
Com `docker compose up --build -d`, o backend cria a conta ao iniciar, após o
PostgreSQL estar pronto. A senha deve ter de 8 a 256 caracteres. Se já existir
um administrador, suas credenciais são preservadas em reinícios.

Com os três campos vazios, a criação pode ser feita pelo comando interativo:

```powershell
docker compose exec backend python -m app.criar_admin
```

O comando solicita nome, e-mail e senha com confirmação oculta.
Recusa outra conta administrativa ou e-mail existente, sem promover uma conta pública,
alterar credenciais ou criar perfil de participante. Não existe endpoint público de
criação/promoção administrativa. Guarde as credenciais no meio privado adotado pela equipe.

Entre em http://localhost:5173 pelo formulário normal. O painel permite filtrar por
status, perfil e nome/e-mail, navegar por páginas, abrir os dados e registrar uma decisão.

## Contrato administrativo

Todas as rotas exigem JWT da aplicação, conta ativa e papel administrativo consultado
no banco em cada requisição. Sem sessão: 401; usuário comum: 403. O JWT não contém
permissão autodeclarada. Revogar o papel/inativar a conta impede novas operações.

| Método | Rota | Resultado |
|---|---|---|
| GET | `/api/admin/cadastros` | Lista paginada e total |
| GET | `/api/admin/cadastros/{perfil}/{id}` | Dados cadastrais e histórico |
| POST | `/api/admin/cadastros/{perfil}/{id}/decisao` | Registra decisão e retorna detalhe atualizado |

`perfil`: `ONG`, `EMPRESA` ou `PESSOA_FISICA`. `id` é o ID do perfil, não o ID da conta.
Perfis/IDs incompatíveis retornam 404; UUID ou enum inválido retorna 422.

Listagem: `status=PENDENTE` por padrão (`APROVADA`/`REPROVADA` também aceitos),
`perfil` opcional, `busca` até 180 caracteres (trecho literal de nome ou e-mail),
`pagina>=1`, `tamanho` de 1 a 100, padrão 20. Ordenação por cadastro mais antigo,
perfil e ID. Resposta: `{itens, total, pagina, tamanho}`. CPF/CNPJ e endereço completo
ficam apenas no detalhe restrito.

Decisão:

```json
{"decisao": "REPROVADA", "justificativa": "Os dados de contato precisam ser conferidos."}
```

Aceita `APROVADA` ou `REPROVADA`. A justificativa é obrigatória na reprovação e tem
limite de 2000 caracteres. Campos extras são recusados. Só cadastros `PENDENTE` podem
ser decididos; nova tentativa ou disputa concorrente retorna 409. O administrador não
pode analisar um perfil pelo qual ele próprio é responsável. Não há reabertura nesta etapa.

A atualização condicional do status, o histórico (quem/quando/motivo) e a notificação
interna são salvos na mesma transação. Falha em qualquer gravação desfaz a decisão.
`GET /api/auth/me` continua devolvendo o status e acrescenta `motivo_reprovacao`, nulo
quando não há reprovação. O botão de consultar situação das telas existentes atualiza
o acesso e mostra o motivo ao responsável reprovado. Não há envio de e-mail nem central
de notificações nesta entrega; o resultado é comunicado pela consulta de situação.

## Escopo e validação

A análise é dos dados cadastrais. Upload/revisão documental ainda não foi implementado;
esta entrega não encerra integralmente o aceite documental da HU05. Doações e reservas
continuam demonstrativas. O novo painel usa os dados reais da API, sem contas ou
cadastros fictícios administrativos automáticos.

Os testes em `backend/tests/test_admin.py` cobrem login, conta única, controle de acesso,
os três perfis, decisões, justificativa, histórico/notificação, filtros, paginação,
revogação, rollback e concorrência PostgreSQL. Execute conforme `backend/README.md`.
No frontend: `npm test`, `npm run lint`, `npm run build`.
