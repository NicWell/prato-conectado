# Cadastro real — contrato backend / frontend

Implementado: cadastro por e-mail/senha de ONG, empresa e pessoa física. Login/vinculação Google e conclusão de perfil autenticada estão descritos em [integração Google](integracao_google.md). Aprovação administrativa, verificação de e-mail local, documentos e recuperação de senha continuam pendentes. Nenhum arquivo do frontend foi alterado.

## Conta e perfil

`usuarios` representa a identidade de acesso. `credenciais_locais` guarda o hash Argon2id. `organizacoes` representa ONG e empresa; `doadores_pessoa_fisica` representa o doador com CPF. Os registros e relacionamentos institucionais existentes são preservados.

O cadastro público cria conta e perfil em uma única transação. Não vincula contas existentes nem aceita papel administrativo, aprovação ou identificador Google. Atribui `USUARIO`, conta ativa e perfil `PENDENTE`. O token permite consultar a sessão enquanto aguarda aprovação; não representa autorização para operar doações.

## Endpoint

`POST /api/auth/cadastro` é público e recebe JSON. O antigo endpoint sugerido `/api/organizacoes` não existe. A confirmação da senha pertence à interface e não deve ser enviada à API.

Exemplo ONG (dados fictícios):

```json
{
  "tipo": "ONG",
  "perfil": "ONG",
  "nome": "ONG Exemplo",
  "responsavel": "Maria Silva",
  "email": "maria@example.org",
  "senha": "Exemplo@123",
  "cnpj": "12.ABC.345/01DE-35",
  "email_contato": "contato@example.org",
  "telefone": "(82) 99999-1234",
  "logradouro": "Rua Exemplo",
  "numero": "100",
  "complemento": null,
  "bairro": "Centro",
  "cidade": "Arapiraca",
  "uf": "AL",
  "cep": "57300-000",
  "capacidade_atendimento": 100
}
```

Para empresa: `tipo=DOADOR`, `perfil=EMPRESA`, CNPJ obrigatório; omitir capacidade e CPF. Para pessoa física: `tipo=DOADOR`, `perfil=PESSOA_FISICA`, substituir CNPJ por `cpf` (exemplo de teste: `529.982.247-25`) e omitir capacidade. `nome` identifica a instituição ou doador; `responsavel` identifica a pessoa titular da conta. Não é exigido CPF do responsável por ONG/empresa.

| Campo | Regra |
|---|---|
| `tipo` / `perfil` | Combinações exatas descritas acima |
| `nome` / `responsavel` | Obrigatórios, até 180/160 caracteres, sem espaços externos |
| `email`, `email_contato` | Obrigatórios, válidos, até 255 caracteres; normalizados para minúsculas |
| `senha` | 8–256 caracteres, não apenas espaços; sem normalização |
| `cnpj` | ONG/empresa: numérico ou alfanumérico, com ou sem máscara |
| `cpf` | Somente pessoa física; com ou sem máscara |
| `telefone` | Brasileiro com DDD, 10/11 dígitos; aceita máscara e prefixo 55 |
| `logradouro`, `numero` | Obrigatórios, até 180/15 caracteres; número aceita `s/n` |
| `complemento` | Opcional/nulo, até 120 caracteres; se enviado, não vazio |
| `bairro`, `cidade` | Obrigatórios, até 100/120 caracteres |
| `uf` | Sigla válida; convertida para maiúsculas |
| `cep` | 8 dígitos, com ou sem hífen |
| `capacidade_atendimento` | Inteiro positivo até 2147483647, obrigatório apenas para ONG |

Campos incompatíveis devem ser omitidos ou enviados como `null`. Campos desconhecidos são rejeitados. Documentos são normalizados sem pontuação; letras do CNPJ são convertidas para maiúsculas. Não há truncamento. A validação dos dígitos verificadores não comprova existência ou regularidade cadastral. O CNPJ usa módulo 11 e ASCII menos 48 conforme a [documentação técnica da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj).

## Respostas

- `201`: formato de `LoginResponse`: `access_token`, `token_type`, `expires_in`, `usuario`. A interface pode iniciar sessão e exibir pendência.
- `409`: `detail` informa e-mail/documento já cadastrado, inclusive em conflitos concorrentes. Não mantém conta parcial.
- `422`: `detail` é lista com `loc`, `msg`, `type`; não contém o payload recebido. Validadores de campo apontam seu campo; combinações inconsistentes apontam `body`.

`usuario` conserva `id`, `usuario_id`, `nome`, `email`, `responsavel`, `tipo`, `perfil`, `status`, `papel_sistema` e acrescenta `cadastro_completo` e `google_vinculado`. `id` identifica a organização ou o perfil PF; `usuario_id` identifica a conta. O novo valor de `perfil` é `PESSOA_FISICA`. CPF, CNPJ, endereço e senha não são expostos por cadastro, login ou `/me`.

O frontend não deve enviar `status`, `papel_sistema`, `ativo`, `google_sub` ou IDs. O contrato de sucesso do login permanece igual; erros `422` agora omitem valores recebidos para proteger dados pessoais. A integração React do cadastro é tarefa da equipe de frontend.

## Limites

Não há edição, upload, aprovação, consulta de documentos ou revogação de token. Google autentica a conta e permite completar o perfil pelo endpoint protegido `/api/auth/perfil`, que recebe os mesmos campos de perfil sem `email`, `senha` e `responsavel`. Vinculação com conta local exige JWT, senha atual e identidade Google verificada, sem união automática por e-mail.

As tabelas futuras de doação/termos ainda referenciam `organizacoes`. Antes de habilitar operações para PF, será necessário evoluir esses relacionamentos e sua aprovação. Esta entrega permite cadastro/login PF; não oferece operações de doação no backend.
