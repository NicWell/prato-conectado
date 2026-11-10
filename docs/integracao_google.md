# Google — autenticação, vinculação e conclusão de cadastro

Backend e integração React/GIS implementados em `services/auth.js`, `GoogleIdentityButton.jsx` e `AuthScreens.jsx`. O fluxo usa Google Identity Services (GIS), callback JavaScript e envio JSON pelo frontend. Não é um callback de redirecionamento OAuth nem aceita access token Google. Tokens Google não são armazenados. A aplicação emite seu próprio JWT após validar o ID token.

## Configuração

No Google Cloud, configurar a tela de consentimento/audiência e criar credencial OAuth do tipo **Aplicativo da Web**. Registrar a origem JavaScript `http://localhost:5173` (ou a origem real); se o aplicativo estiver em teste, configurar os usuários de teste conforme a audiência definida. Para este fluxo de callback JavaScript não existe rota backend de redirecionamento.

No `.env` da raiz:

```env
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
```

É identificador público, não Client Secret. O frontend precisa usar o mesmo Client ID ao inicializar GIS. Não é necessário JSON de conta de serviço, Client Secret, Drive ou permissões de Gmail. Não alterar `FRONTEND_ORIGINS` para `*`.

O Compose repassa `GOOGLE_CLIENT_ID` como argumento de build `VITE_GOOGLE_CLIENT_ID` ao React. Para Vite local, configure `VITE_GOOGLE_CLIENT_ID` em `frontend/.env.local` com o mesmo identificador. O botão oficial e os fluxos de primeiro acesso/vinculação já estão integrados. Reconstrua o frontend após alterar o Client ID.

Aplicar a [migration 004](../database/README.md) antes de iniciar o backend atualizado em volume existente. Então executar `docker compose up --build -d`. Se o Client ID estiver vazio, as rotas Google retornam 503 `GOOGLE_NAO_CONFIGURADO`; login/cadastro local continuam funcionando. Alterar `.env` exige recriar o backend, não somente reiniciar seu processo.

## 1. Login Google e primeiro acesso

1. O frontend solicita `POST /api/auth/google/desafio`, sem corpo. Resposta 201:

   ```json
   {"desafio_id":"UUID", "nonce":"VALOR_ALEATORIO", "expires_in":300}
   ```

2. Guardar o desafio somente para a tentativa atual. Ao inicializar `google.accounts.id.initialize`, fornecer `client_id`, `nonce` recebido e callback. O ID token vem em `response.credential`.
3. Enviar JSON a `POST /api/auth/google`:

   ```json
   {"desafio_id":"UUID", "id_token":"VALOR_DE_response.credential"}
   ```

4. A API retorna 200 com o formato de sessão existente: `access_token`, `token_type`, `expires_in`, `usuario`. Armazenar o JWT da aplicação pelo serviço de sessão existente; não usar o token Google nas chamadas `/me`.

Assinatura, emissor, destinatário, emissão/expiração são verificados pela biblioteca oficial `google-auth`. Também exigimos `sub`, `email_verified=true`, authorized party compatível quando presente e correspondência do nonce. A busca da conta usa `sub`, nunca apenas e-mail.

Se o `sub` for novo e não houver colisão de e-mail, a API cria apenas `usuarios`, sem senha, sem documento e sem organização. O primeiro retorno tem `tipo/perfil=SEM_ORGANIZACAO`, `status=PENDENTE` e `cadastro_completo=false`. O status antigo é mantido por compatibilidade; o frontend deve verificar primeiro `cadastro_completo` para decidir se precisa mostrar o formulário.

Se o e-mail já estiver cadastrado com outra identidade, a API retorna 409 `VINCULACAO_NECESSARIA`, sem criar ou unir contas. A pessoa deve entrar pelo método existente e seguir o fluxo explícito de vinculação abaixo. Um `sub` já conhecido continua identificando a mesma conta, mesmo se o e-mail no Google mudar; a API não atualiza automaticamente o e-mail local.

## 2. Vincular Google à conta local

1. Entrar por `POST /api/auth/login`.
2. Com `Authorization: Bearer <JWT_DA_APLICACAO>`, solicitar `POST /api/auth/google/vincular/desafio`.
3. Solicitar ao usuário a seleção da conta Google, usando esse novo nonce no GIS. O Google escolhido deve ter o mesmo e-mail da conta local.
4. Com o mesmo JWT, enviar `POST /api/auth/google/vincular`:

   ```json
   {
     "desafio_id":"UUID_DO_DESAFIO_DE_VINCULACAO",
     "id_token":"ID_TOKEN_GOOGLE",
     "senha_atual":"SENHA_DA_CONTA_LOCAL"
   }
   ```

5. Resposta 200: sessão e usuário, com `google_vinculado=true`. A senha, o perfil, o documento e a aprovação existentes são preservados. A conta passa a aceitar senha e Google.

Um desafio de login não pode vincular conta; um desafio de vinculação pertence à conta autenticada que o solicitou. Não é permitido substituir uma identidade Google diferente já vinculada nem usar um `sub` pertencente a outra conta. A reconfirmação da senha local evita que uma sessão antiga, sozinha, autorize essa alteração. Não há endpoint de desvinculação ou troca de conta Google nesta entrega. Contas exclusivamente Google não recebem senha local automaticamente.

## 3. Completar CPF/CNPJ e endereço

Com o JWT obtido no primeiro acesso, enviar `POST /api/auth/perfil`. Usa os campos e validações de [cadastro real](cadastro_real.md), **sem `email`, `senha` e `responsavel`**. A identidade e o responsável vêm da conta autenticada. Exemplo de ONG:

```json
{
  "tipo":"ONG", "perfil":"ONG", "nome":"ONG Exemplo",
  "cnpj":"12.ABC.345/01DE-35", "capacidade_atendimento":100,
  "email_contato":"contato@example.org", "telefone":"82999991234",
  "logradouro":"Rua Exemplo", "numero":"100", "complemento":null,
  "bairro":"Centro", "cidade":"Arapiraca", "uf":"AL", "cep":"57300000"
}
```

Resposta 201: objeto público `usuario` diretamente (sem novo token), com `cadastro_completo=true` e `status=PENDENTE`. O JWT anterior continua válido. ONG e empresa exigem CNPJ; pessoa física exige CPF. Concluir novamente retorna 409; documento duplicado também retorna 409 sem criar perfil parcial. O endpoint não altera um perfil existente e serializa conclusões concorrentes da mesma conta no PostgreSQL.

## Respostas e tratamento no frontend

`usuario` ganhou dois campos booleanos aditivos, presentes também no login local e em `/me`: `cadastro_completo` e `google_vinculado`. Os demais campos de sucesso foram preservados. Ordem de navegação: completar perfil quando `cadastro_completo=false`; mostrar pendência quando completo e PENDENTE; permitir área aprovada quando APROVADA. Reprovação deve ter tratamento visual próprio.

| HTTP | `detail.codigo` nas rotas Google | Ação |
|---|---|---|
| 401 | `TOKEN_GOOGLE_INVALIDO`, `DESAFIO_INVALIDO` | Solicitar novo desafio e repetir seleção/autenticação |
| 401 | `SENHA_INVALIDA` | Reconfirmar senha local |
| 401 | `CONTA_INDISPONIVEL` | Não liberar acesso |
| 409 | `VINCULACAO_NECESSARIA` | Entrar pelo método existente e vincular explicitamente |
| 409 | `EMAIL_GOOGLE_DIFERENTE`, `GOOGLE_JA_VINCULADO` | Mostrar `detail.mensagem`, sem trocar a identidade |
| 409 | `CONFLITO_DE_CONTA` | Atualizar sessão e tentar novamente |
| 503 | `GOOGLE_NAO_CONFIGURADO` | Não oferecer acesso Google até configurar |
| 503 | `GOOGLE_INDISPONIVEL` | Informar indisponibilidade temporária, sem fallback inseguro |

Payload inválido retorna 422 no formato já documentado, sem ecoar senha ou token. Ausência de Bearer nas rotas protegidas usa o 401 já existente. `/perfil` mantém `detail` textual para conflitos como o cadastro local. O serviço frontend atual precisa aprender a ler `detail.mensagem` nas novas rotas.

## Desafios e limites

Desafios duram cinco minutos; o banco guarda somente hash do nonce. O consumo ocorre na mesma transação da autenticação/vinculação bem-sucedida. Mesmo em duas requisições simultâneas, apenas uma pode consumir o desafio. Tentativas recusadas não criam vínculos e não consomem o desafio; ele expira normalmente. Após sucesso, cancelamento ou expiração, iniciar uma nova tentativa com novo desafio.

O frontend deve guardar o desafio da tentativa que ele próprio iniciou e nunca aceitar desafio/token vindo de URL ou de mensagem sem origem validada. Este contrato não recebe POST automático GIS com cookie: se a equipe adotar `login_uri`/redirect, precisará de contrato separado com validação de CSRF. O callback JavaScript envia explicitamente JSON e usa Bearer nas rotas protegidas; a API não autentica por cookies.

A integração GIS no React está implementada. Falta registrar o aceite do consentimento real, primeiro acesso e vinculação com o Client ID do projeto. Testes automatizados usam certificados locais, sem bypass de validação em runtime. Aprovação, documentos, recuperação de senha e autorização operacional de doações permanecem fora desta etapa. A validação de e-mail Google não constitui comprovação de CPF/CNPJ. Monitoramento, rate limiting e limpeza periódica de desafios expirados devem ser incluídos na preparação para produção.

Referências: [verificação no backend](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [nonce e callback GIS](https://developers.google.com/identity/gsi/web/reference/js-reference), [google-auth Python](https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.id_token.html).
