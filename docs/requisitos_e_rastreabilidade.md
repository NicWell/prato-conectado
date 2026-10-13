# Rastreabilidade — backlog de histórias e critérios de aceite

**Fonte prioritária:** `Gestão de Projeto - Acompanhamento de Histórias e Aceite.xlsx`, guia “Gestão de Projetos - PROIN”. Os números e sprints abaixo foram extraídos da planilha; o mapeamento físico é uma **proposta técnica**.

| HU | História | Prioridade | Sprint | Tabelas propostas | Resultado a validar |
|---|---|---|---:|---|---|
| HU01 | Tela de Login com Google | Indispensável | 1 | `usuarios` | Google OAuth, retorno após login, erro tratado |
| HU02 | Cadastro de restaurante/doador | Indispensável | 1 | `usuarios`, `organizacoes` | CNPJ, endereço/contato; `PENDENTE` após cadastro |
| HU03 | Cadastro de Voluntários | Indispensável | 1 | `voluntarios`, `organizacoes` | Nome, endereço e contato; vínculo obrigatório com ONG existente |
| HU04 | Cadastro de ONG/casa de apoio | Indispensável | 2 | `organizacoes` | CNPJ, endereço, contato e capacidade; pendente de aprovação |
| HU05 | Verificação pelo administrador | Importante | 3 | `documentos_organizacao`, `analises_cadastro`, `organizacoes`, `usuarios`, `notificacoes` | Revisão dos documentos, aprovação/reprovação justificada, aviso ao usuário, bloqueio antes de aprovar |
| HU06 | Cadastro de alimento para doação | Indispensável | 4 | `doacoes`, `itens_doacao`, `categorias_alimento` | Até 3 passos, tipo/quantidade/validade/janela de retirada, validade futura, status `DISPONIVEL` após publicação válida |
| HU07 | Termo e checklist de triagem | Indispensável | 4 | `termos_responsabilidade`, `aceites_termo`, `triagens_doacao`, `doacoes` | Aceite rastreável; triagem do doador e da ONG; impossibilidade de publicar sem aceite |
| HU08 | Necessidades da ONG e filtros | Indispensável | 4 | `necessidades_ong`, `categorias_alimento`, `itens_doacao`, `doacoes` | Publicar necessidades e filtrar por tipo, quantidade e validade |
| HU09 | Agenda de disponibilidade/retirada | Indispensável | 5 | `doacoes`, `historico_doacao` | Início/fim da retirada, janela válida e expiração para `ENCERRADA` |

## Critérios de aceite e implicações de domínio

### HU01 — Autenticação Google

Login deve usar conta Google e validar `sub` (identificador da conta) e e-mail. Botão, redirecionamento e exibição de erros pertencem ao frontend/integrador OAuth. O banco não armazena tokens de acesso do Google neste modelo inicial.

### HU02/HU04 — Registro institucional

`organizacoes.tipo` distingue `DOADOR` e `ONG`, evitando duplicação de cadastro. `status_verificacao` inicia como `PENDENTE`, e `capacidade_atendimento` atende às informações específicas da ONG. CNPJ tem formatação normalizada no banco; sua validade matemática deve ser verificada na API.

### HU03 — Voluntários vinculados

`voluntarios.ong_id` é `NOT NULL` e referência a uma organização existente. A confirmação de `organizacoes.tipo = ONG` é uma regra de serviço; FK simples, isolada, não certifica o tipo. Não há conta Google obrigatória para voluntário no backlog.

### HU05 — Aprovação e comunicação

`documentos_organizacao` referencia arquivos privados; `analises_cadastro` registra decisão, administrador e motivo obrigatório de rejeição. `notificacoes` armazena avisos **internos** à plataforma, sem pressupor push externo. O backend deve exigir administrador e sincronizar decisão/status/notificação em transação.

### HU06 — Ofertas de alimentos

`itens_doacao` contém tipo, quantidade e validade. `doacoes` define a janela para a oferta e permite várias linhas de alimento. Estado `RASCUNHO` é proposta para suportar triagem e termo antes de ir para `DISPONIVEL`. Tempo de até três passos é requisito de interface, não uma propriedade de tabela.

### HU07 — Termo e triagens

O termo tem versão e conteúdo. `aceites_termo` prova quem aceitou, quando e em nome de qual organização. `doacoes.aceite_termo_id` vincula o aceite à oferta. `triagens_doacao` guarda duas etapas (`DOADOR_CADASTRO`, `ONG_RECEBIMENTO`) com checklist em JSONB validado pela API.

### HU08 — Necessidades e pesquisa

`necessidades_ong` usa a mesma classificação `categorias_alimento` dos itens doados. Filtrar por unidade/quantidade compatível exige decisão de negócio: por exemplo, 3 kg não são diretamente comparáveis a 3 unidades. A visibilidade de necessidades aos doadores depende das permissões.

### HU09 — Janelas e expiração

`doacoes.inicio_retirada` e `fim_retirada` determinam o agendamento. Transição automática para `ENCERRADA` demanda uma tarefa periódica no backend. `historico_doacao` registra o fato e horário. `TIMESTAMPTZ` evita ambiguidade no armazenamento temporal.

## Registros de aceitação já existentes no backlog

A planilha marca **todos os itens como ainda não aceitos** (`Aceito? = NÃO`). HU02 está marcada como **Fazendo** e as demais como **A fazer**. Esta documentação **não altera** o status ou aceite de nenhuma história.
