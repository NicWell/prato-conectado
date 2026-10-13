# Regras de negócio e decisões a validar

O que segue combina critérios **expressos no backlog** com **decisões técnicas propostas**, explicitamente sinalizadas.

## Regras decorrentes dos critérios de aceite

| Regra | Validação necessária | Origem |
|---|---|---|
| RN01 | Identificar o usuário pela conta Google, tratar retorno e falhas de login | HU01 |
| RN02 | Cadastro de organização exige nome, CNPJ, endereço e contato, iniciando `PENDENTE` | HU02/HU04 |
| RN03 | Voluntário requer ONG já cadastrada, além de nome/endereço/contato | HU03 |
| RN04 | Antes de operar doações, a organização deve estar `APROVADA` | HU05 |
| RN05 | Reprovação administrativa exige justificativa e comunicação ao responsável | HU05 |
| RN06 | Alimento deve ter categoria, quantidade positiva, validade futura e janela de retirada válida | HU06 |
| RN07 | Publicação da doação exige aceite do termo e checklist do doador | HU07 |
| RN08 | Recebimento exige checklist de triagem preenchido pela ONG | HU07 |
| RN09 | ONG pode registrar necessidades e filtrar ofertas por tipo, quantidade e validade | HU08 |
| RN10 | Doação fora da janela válida deve deixar de estar disponível e expirar para `ENCERRADA` | HU09 |

## Decisões de modelagem propostas (não estabelecidas formalmente pela equipe)

1. **Cadastro único de organização:** `organizacoes` distingue DOADOR e ONG por `tipo`, em vez de criar tabelas duplicadas. `voluntarios` permanece separado por seu vínculo específico com a ONG.
2. **Fluxo rascunho → disponível → reservada → retirada → entregue:** estados `RASCUNHO`, `RESERVADA`, `RETIRADA` e `ENTREGUE` são detalhamento de projeto, não nomes integralmente fixados no backlog. O status `ENCERRADA` vem de HU09.
3. **Termo versionado:** salvar texto/versão por histórico. O conteúdo depende de aprovação jurídica; não presumir que a Lei 14.016/2020 forneça isenção automática de responsabilidade.
4. **Doação com vários itens:** oferta `doacoes` possui linhas em `itens_doacao`; atende o cenário de um estabelecimento oferecer itens diferentes na mesma retirada.
5. **Controle de reserva:** uma doação não pode ter duas solicitações aceitas simultaneamente (índice único parcial no PostgreSQL); a atualização de `doacoes.status` é transacional no backend.
6. **Notificações internas:** `notificacoes` atende o registro do aviso HU05, sem exigir serviço de e-mail ou push para a primeira etapa.
7. **Checklist JSONB:** armazena respostas estruturadas, cuja completude deve ser validada com esquema tipado no backend.
8. **Voluntário sem conta própria:** HU03 prevê cadastro pela ONG; conta de voluntário e atribuição de rotas ficam fora do escopo detalhado das nove histórias.

## Conflitos, ambiguidades e pendências para o Product Owner

| Ponto | Material identificado | Tratamento desta proposta |
|---|---|---|
| Voluntário obrigatório ou opcional? | Definição inicial marca voluntários opcionais; HU03 é indispensável na sprint 1. | Incluído no banco; execução por voluntários/gestão de rotas fora do fluxo obrigatório de doação. |
| Integrações externas | Briefing indica ausência inicial de integrações; HU01 requer login Google. | HU01 prevalece para a autenticação; depende de Google OAuth. |
| HU04, critério 3 | Texto menciona “doador” em uma história de ONG, aparentemente texto reaproveitado. | ONG também inicia `PENDENTE`; confirmar com equipe. |
| Expiração versus reserva | HU09 diz que doação expirada muda para `ENCERRADA`; não distingue reservada e pendente. | Proposta: encerrar DISPONIVEL e RESERVADA sem retirada; revisão das exceções. |
| Visibilidade antes do início da coleta | HU09 afirma que ONG só vê doações “dentro da janela válida”. | Interpretar literalmente nesta versão; confirmar se deve permitir descoberta/reserva antecipada. |
| Checklist concreto | HU07 não lista perguntas, respostas válidas ou tratamento de alimento impróprio. | JSONB e enum APTA/INAPTA; formular checklist após validação com especialista. |
| Google OAuth e administrador | HU01 pede login Google; HU05 pede perfil de administrador. | `usuarios.papel_sistema` inclui ADMINISTRADOR; atribuição segura do papel será administrativa, nunca autodeclarada. |
| Quantidade e unidade | HU08 exige filtro de quantidade, mas não especifica conversões. | Mostrar a unidade; comparar quantidade apenas se unidade coincidir, até definir conversão. |
| Perfil responsável | O backlog não explicita múltiplos funcionários com permissão em uma organização. | Uma pessoa responsável por organização no primeiro modelo; associação multiusuário poderá ser implementada depois. |

## Regras que **não** estão automatizadas apenas pelo esquema SQL

- Tipo ONG para os relacionamentos `voluntarios.ong_id`, `necessidades_ong.ong_id` e `solicitacoes_doacao.ong_id`.
- Tipo DOADOR de `doacoes.doador_id`.
- Autorização administrativa e confirmação do status de aprovação de organizações.
- Validação de dígitos verificadores do CNPJ, completude dos documentos e compatibilidade de termo/organização/usuário.
- Validade futura do alimento, triagem obrigatória na publicação e confirmação de recebimento.
- Busca de ofertas por tempo e filtros, alteração automática de status e notificações.

Essas verificações devem ser implementadas em Python (FastAPI/SQLAlchemy) e testadas, idealmente com transações e testes de concorrência.
