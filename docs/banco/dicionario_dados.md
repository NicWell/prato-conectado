# Dicionário de dados — Prato Conectado

Versão **1.2** — esquema após migrations 002–004; autenticação local/Google e cadastro implementados, demais domínios ainda modelados.

**Convenções:** PK = chave primária; FK = chave estrangeira; UK = único. O SQL define UUIDs por `gen_random_uuid()`; o ORM também pode gerar UUIDs em Python. `TIMESTAMPTZ` preserva instante com fuso. E-mails e documentos são validados pela API.

## usuarios

Pessoas autenticadas por conta Google e administradores da plataforma.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador do usuário. |
| `google_sub` | `VARCHAR(255)` | UK, opcional após 002 | Identificador estável da conta Google, validado pelo backend. |
| `nome` | `VARCHAR(160)` | obrigatório | Nome apresentado na plataforma. |
| `email` | `VARCHAR(255)` | obrigatório | Endereço de e-mail obtido da autenticação Google. |
| `papel_sistema` | `VARCHAR(20)` | obrigatório, padrão: `'USUARIO'`, CHECK | USUARIO ou ADMINISTRADOR. |
| `ativo` | `BOOLEAN` | obrigatório, padrão: `TRUE` | Bloqueio lógico de acesso. |
| `criado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Momento do primeiro cadastro. |

## organizacoes

Cadastro comum a doadores e ONGs, com aprovação administrativa.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador da organização. |
| `usuario_responsavel_id` | `UUID` | FK → `usuarios.id`, obrigatório | Pessoa que cadastrou e representa a organização. |
| `tipo` | `VARCHAR(12)` | obrigatório, CHECK | DOADOR ou ONG. |
| `nome` | `VARCHAR(180)` | obrigatório | Razão social ou nome da instituição. |
| `cnpj` | `CHAR(14)` | UK, obrigatório, CHECK | 12 caracteres A–Z/0–9 e dois dígitos, sem pontuação (003). |
| `email_contato` | `VARCHAR(255)` | obrigatório | E-mail institucional para contato. |
| `telefone` | `VARCHAR(25)` | obrigatório | Telefone de contato. |
| `logradouro` | `VARCHAR(180)` | obrigatório | Endereço: rua/avenida. |
| `numero` | `VARCHAR(15)` | obrigatório | Número do imóvel. |
| `complemento` | `VARCHAR(120)` | opcional | Complemento do endereço. |
| `bairro` | `VARCHAR(100)` | obrigatório | Bairro. |
| `cidade` | `VARCHAR(120)` | obrigatório | Cidade. |
| `uf` | `CHAR(2)` | obrigatório | Unidade federativa. |
| `cep` | `CHAR(8)` | obrigatório, CHECK | CEP normalizado em oito dígitos. |
| `capacidade_atendimento` | `INTEGER` | CHECK | Capacidade estimada de atendimento; informação da ONG. |
| `status_verificacao` | `VARCHAR(12)` | obrigatório, padrão: `'PENDENTE'`, CHECK | PENDENTE, APROVADA ou REPROVADA. |
| `criado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data de envio do cadastro. |

## documentos_organizacao

Referências seguras aos documentos para conferência administrativa.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador do arquivo/documento. |
| `organizacao_id` | `UUID` | FK → `organizacoes.id`, obrigatório | Organização titular do documento. |
| `enviado_por_id` | `UUID` | FK → `usuarios.id`, obrigatório | Usuário que enviou o documento. |
| `tipo` | `VARCHAR(12)` | obrigatório, CHECK | CNPJ, ALVARA, ESTATUTO ou OUTRO. |
| `chave_arquivo` | `VARCHAR(500)` | obrigatório | Identificador de armazenamento privado do arquivo. |
| `nome_arquivo` | `VARCHAR(255)` | obrigatório | Nome original para exibição. |
| `enviado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data/hora de envio. |

## analises_cadastro

Trilha de aprovação ou reprovação por administrador.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador da análise. |
| `organizacao_id` | `UUID` | FK → `organizacoes.id`, obrigatório | Organização avaliada. |
| `administrador_id` | `UUID` | FK → `usuarios.id`, obrigatório | Administrador que decidiu. |
| `decisao` | `VARCHAR(10)` | obrigatório, CHECK | APROVADA ou REPROVADA. |
| `justificativa` | `TEXT` | opcional | Justificativa obrigatória na reprovação. |
| `analisado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data/hora da decisão. |

Restrições adicionais: `CHECK (decisao <> 'REPROVADA' OR NULLIF(BTRIM(justificativa), '') IS NOT NULL)`.

## voluntarios

Voluntários cadastrados sob responsabilidade de uma ONG, sem login obrigatório no MVP.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador do voluntário. |
| `ong_id` | `UUID` | FK → `organizacoes.id`, obrigatório | Organização ONG à qual o voluntário pertence. |
| `nome` | `VARCHAR(160)` | obrigatório | Nome do voluntário. |
| `email` | `VARCHAR(255)` | opcional | E-mail de contato. |
| `telefone` | `VARCHAR(25)` | obrigatório | Telefone de contato. |
| `logradouro` | `VARCHAR(180)` | obrigatório | Endereço do voluntário. |
| `numero` | `VARCHAR(15)` | obrigatório | Número do endereço. |
| `bairro` | `VARCHAR(100)` | obrigatório | Bairro. |
| `cidade` | `VARCHAR(120)` | obrigatório | Cidade. |
| `uf` | `CHAR(2)` | obrigatório | UF. |
| `cep` | `CHAR(8)` | obrigatório, CHECK | CEP em oito dígitos. |
| `ativo` | `BOOLEAN` | obrigatório, padrão: `TRUE` | Indicador de vínculo ativo. |
| `criado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data de cadastramento. |

## categorias_alimento

Tipos padronizados utilizados nos itens, filtros e necessidades.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador da categoria. |
| `nome` | `VARCHAR(100)` | UK, obrigatório | Ex.: pães, hortifrúti, refeições prontas. |
| `ativa` | `BOOLEAN` | obrigatório, padrão: `TRUE` | Disponível para novos cadastros. |

## necessidades_ong

Categorias e quantidades de alimento demandadas por uma ONG.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador da necessidade. |
| `ong_id` | `UUID` | FK → `organizacoes.id`, obrigatório | ONG que cadastrou a necessidade. |
| `categoria_id` | `UUID` | FK → `categorias_alimento.id`, obrigatório | Categoria desejada. |
| `quantidade_desejada` | `NUMERIC(12,3)` | obrigatório, CHECK | Quantidade-alvo desejada. |
| `unidade` | `VARCHAR(20)` | obrigatório | Unidade da quantidade cadastrada. |
| `observacao` | `TEXT` | opcional | Restrições ou observações opcionais. |
| `ativa` | `BOOLEAN` | obrigatório, padrão: `TRUE` | Necessidade visível. |
| `criado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data de criação. |

## termos_responsabilidade

Textos versionados, sujeitos a revisão jurídica.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador do termo. |
| `versao` | `VARCHAR(30)` | UK, obrigatório | Versão do documento, ex.: 1.0. |
| `titulo` | `VARCHAR(160)` | obrigatório | Nome do termo apresentado no aceite. |
| `conteudo` | `TEXT` | obrigatório | Texto exibido ao usuário (revisão jurídica requerida). |
| `ativo` | `BOOLEAN` | obrigatório, padrão: `FALSE` | Identifica termos liberados para uso. |
| `criado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data de criação da versão. |

## aceites_termo

Registro verificável de aceite individual e da organização representada.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador do aceite. |
| `termo_id` | `UUID` | FK → `termos_responsabilidade.id`, obrigatório | Versão efetivamente aceita. |
| `usuario_id` | `UUID` | FK → `usuarios.id`, obrigatório | Quem aceitou. |
| `organizacao_id` | `UUID` | FK → `organizacoes.id`, obrigatório | Organização representada no momento do aceite. |
| `aceito_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data/hora do aceite. |

Restrições adicionais: `UNIQUE (termo_id, usuario_id, organizacao_id)`.

## doacoes

Oferta criada por um doador, com agenda de coleta e ciclo de status.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador da doação. |
| `doador_id` | `UUID` | FK → `organizacoes.id`, obrigatório | Organização que disponibiliza alimentos. |
| `criado_por_id` | `UUID` | FK → `usuarios.id`, obrigatório | Usuário responsável por publicar a doação. |
| `aceite_termo_id` | `UUID` | FK → `aceites_termo.id` | Comprovante de aceite usado na publicação. |
| `titulo` | `VARCHAR(180)` | obrigatório | Título descritivo da oferta. |
| `descricao` | `TEXT` | opcional | Informações complementares. |
| `periodo` | `VARCHAR(10)` | obrigatório, padrão: `'OUTRO'`, CHECK | CAFE, ALMOCO, JANTAR ou OUTRO. |
| `inicio_retirada` | `TIMESTAMPTZ` | obrigatório | Data/hora em que a retirada pode começar. |
| `fim_retirada` | `TIMESTAMPTZ` | obrigatório | Limite final da janela de retirada. |
| `status` | `VARCHAR(20)` | obrigatório, padrão: `'RASCUNHO'`, CHECK | RASCUNHO, DISPONIVEL, RESERVADA, RETIRADA, ENTREGUE, CANCELADA ou ENCERRADA. |
| `criado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Momento da criação da oferta. |
| `atualizado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Momento da última atualização; atualizado pela aplicação. |

Restrições adicionais: `CHECK (fim_retirada > inicio_retirada)`.

## itens_doacao

Alimentos e respectivas quantidades/validades em uma doação.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador do item. |
| `doacao_id` | `UUID` | FK → `doacoes.id`, obrigatório | Doação à qual pertence. |
| `categoria_id` | `UUID` | FK → `categorias_alimento.id`, obrigatório | Tipo/categoria utilizado nos filtros. |
| `descricao` | `VARCHAR(200)` | obrigatório | Descrição do alimento. |
| `quantidade` | `NUMERIC(12,3)` | obrigatório, CHECK | Quantidade positiva da oferta. |
| `unidade` | `VARCHAR(20)` | obrigatório | Unidade da quantidade. |
| `validade_em` | `TIMESTAMPTZ` | obrigatório | Data/hora limite de validade. |

## triagens_doacao

Checklist preenchido na publicação pelo doador e no recebimento pela ONG.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador da triagem. |
| `doacao_id` | `UUID` | FK → `doacoes.id`, obrigatório | Doação a que se refere. |
| `organizacao_id` | `UUID` | FK → `organizacoes.id`, obrigatório | Organização responsável pela verificação. |
| `preenchido_por_id` | `UUID` | FK → `usuarios.id`, obrigatório | Usuário que preencheu o checklist. |
| `etapa` | `VARCHAR(20)` | obrigatório, CHECK | DOADOR_CADASTRO ou ONG_RECEBIMENTO. |
| `resultado` | `VARCHAR(10)` | obrigatório, CHECK | APTA ou INAPTA. |
| `respostas` | `JSONB` | obrigatório, CHECK | Checklist com perguntas/respostas na estrutura validada pela aplicação. |
| `preenchido_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data/hora do preenchimento. |

Restrições adicionais: `UNIQUE (doacao_id, etapa)`.

## solicitacoes_doacao

Interesse da ONG e confirmação da reserva pelo doador.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador da solicitação. |
| `doacao_id` | `UUID` | FK → `doacoes.id`, obrigatório | Doação solicitada. |
| `ong_id` | `UUID` | FK → `organizacoes.id`, obrigatório | ONG interessada na doação. |
| `solicitado_por_id` | `UUID` | FK → `usuarios.id`, obrigatório | Usuário que solicitou. |
| `status` | `VARCHAR(12)` | obrigatório, padrão: `'PENDENTE'`, CHECK | PENDENTE, ACEITA, RECUSADA ou CANCELADA. |
| `observacao` | `TEXT` | opcional | Observação da solicitação/resposta. |
| `solicitado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data/hora de solicitação. |
| `respondido_em` | `TIMESTAMPTZ` | opcional | Data/hora de aceite/recusa/cancelamento. |

## historico_doacao

Auditoria de cada alteração de status, incluindo encerramentos automáticos.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador do evento. |
| `doacao_id` | `UUID` | FK → `doacoes.id`, obrigatório | Doação alterada. |
| `alterado_por_id` | `UUID` | FK → `usuarios.id` | Usuário que alterou, nulo em evento automatizado. |
| `status_anterior` | `VARCHAR(20)` | opcional | Status antes da transição; nulo no primeiro evento. |
| `status_novo` | `VARCHAR(20)` | obrigatório | Status após a transição. |
| `observacao` | `TEXT` | opcional | Justificativa/causa da transição. |
| `criado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data/hora da transição. |

## notificacoes

Comunicados internos de aprovação, reprovação e outros eventos.

| Coluna | Tipo PostgreSQL | Regras | Descrição |
|---|---|---|---|
| `id` | `UUID` | PK, padrão: `gen_random_uuid()` | Identificador da notificação. |
| `usuario_id` | `UUID` | FK → `usuarios.id`, obrigatório | Pessoa destinatária. |
| `tipo` | `VARCHAR(35)` | obrigatório | Ex.: CADASTRO_APROVADO, CADASTRO_REPROVADO. |
| `titulo` | `VARCHAR(160)` | obrigatório | Título exibido no app. |
| `mensagem` | `TEXT` | obrigatório | Conteúdo da notificação. |
| `lida_em` | `TIMESTAMPTZ` | opcional | Data/hora da leitura; nulo enquanto não lida. |
| `criado_em` | `TIMESTAMPTZ` | obrigatório, padrão: `NOW()` | Data/hora do aviso. |

## Índices e decisões de performance

O SQL traz índices para status e janela da doação, categoria/validade do item, necessidades, solicitações e notificações. Índices únicos parciais protegem contra duas reservas aceitas para a mesma doação e solicitações ativas duplicadas da mesma ONG.

## Nota de implementação

### credenciais_locais (002)

`usuario_id UUID` é PK/FK para `usuarios`, com `ON DELETE CASCADE`. `senha_hash VARCHAR(255)` é obrigatório e guarda Argon2id. `atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()` fica sob responsabilidade da aplicação; não existe trigger de atualização.

### doadores_pessoa_fisica (003)

| Coluna | Tipo / regra |
|---|---|
| `id` | UUID PK, padrão `gen_random_uuid()` |
| `usuario_responsavel_id` | UUID obrigatório, único, FK `usuarios.id` |
| `nome` | VARCHAR(180), obrigatório |
| `cpf` | VARCHAR(11), obrigatório, único, CHECK 11 dígitos |
| `email_contato`, `telefone` | VARCHAR(255)/VARCHAR(25), obrigatórios |
| `logradouro`, `numero` | VARCHAR(180)/VARCHAR(15), obrigatórios |
| `complemento` | VARCHAR(120), opcional |
| `bairro`, `cidade`, `uf`, `cep` | VARCHAR(100)/VARCHAR(120)/VARCHAR(2)/VARCHAR(8), obrigatórios; CEP com CHECK 8 dígitos |
| `status_verificacao` | VARCHAR(12), obrigatório, padrão PENDENTE; CHECK PENDENTE/APROVADA/REPROVADA |
| `criado_em` | TIMESTAMPTZ obrigatório, padrão NOW() |

`schema_migrations` é tabela técnica: `versao VARCHAR(80) PRIMARY KEY` e `aplicada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()`, com rastreio a partir de 003; sem presumir histórico das migrations legadas.

### desafios_google (004)

`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `nonce_hash VARCHAR(64) NOT NULL UNIQUE`, `finalidade VARCHAR(10) NOT NULL`, `usuario_id UUID REFERENCES usuarios(id)` opcional, `expira_em TIMESTAMPTZ NOT NULL` com índice e `consumido_em TIMESTAMPTZ` opcional. CHECKs permitem LOGIN sem usuário ou VINCULAR com usuário. O nonce original não é armazenado. Consumo condicional ocorre na transação de login/vinculação e impede replay, inclusive concorrente. Limpeza de desafios expirados ainda não é agendada.

O ORM representa Usuario, CredencialLocal, Organizacao, DoadorPessoaFisica e DesafioGoogle. Não confundir tabela criada com funcionalidade implementada.

Regras de negócio que envolvem horário corrente, situação de aprovação e validações entre registros não são totalmente expressáveis por `CHECK` simples. Devem ser implementadas no backend Python e testadas em transações PostgreSQL.
