# Prato Conectado — Frontend da Sprint (mock + Docker)

Aplicação React + Vite baseada no protótipo recebido. Contém **login, criação de usuários (doador empresa, doador pessoa física e ONG), aprovação pendente, painel do doador, criação e gestão de doações, oportunidades e reservas da ONG, recuperação de senha simulada, alternância entre modo escuro e claro**.

O projeto não exige banco nem backend para testar os fluxos demonstrativos.

## 1. Executar com Docker (recomendado)

Pré-requisitos: Docker Desktop (ou Docker Engine + Compose), com Docker funcionando.

Coloque a pasta `frontend/` e `docker-compose.frontend.yml` na **raiz do seu repositório**, ao lado das pastas `backend/`, `database/` e `docs/`, sem substituir o `docker-compose.yml` da equipe.

Na raiz do repositório:

```bash
docker compose -f docker-compose.frontend.yml up --build -d
```

Abra **http://localhost:5173**. Para parar:

```bash
docker compose -f docker-compose.frontend.yml down
```

Para acompanhar logs:

```bash
docker compose -f docker-compose.frontend.yml logs -f frontend
```

Se a porta 5173 já estiver ocupada, altere `"5173:80"` em `docker-compose.frontend.yml` para `"5174:80"` e abra http://localhost:5174.

> O Dockerfile faz um build em `node:22-alpine` e usa Nginx para servir o React na porta 80. O Compose expõe a porta **5173** da máquina. O servidor do backend pode ser adicionado ao Compose da equipe depois, sem alterar a imagem do frontend mock.

## 2. Executar sem Docker (modo desenvolvimento)

No terminal:

```bash
cd frontend
npm ci
npm run dev
```

Abra o endereço apresentado pelo Vite, geralmente **http://localhost:5173**.

> `npm ci` precisa de acesso ao npm registry na primeira execução. O código é JavaScript/JSX e não precisa de biblioteca extra além do React/Vite já definidos no `package-lock.json`.

## 3. Contas prontas para testar

| Perfil | E-mail | Senha | Aprovação |
|---|---|---|---|
| Doador empresa | `doador@demo.com` | `Teste@123` | APROVADA |
| ONG | `ong@demo.com` | `Teste@123` | APROVADA |

Na tela inicial, o botão **Entrar com Google (mock)** simula a autenticação da conta demonstrativa do doador; **não realiza OAuth**. Você também pode abrir **Contas de demonstração e restauração** e escolher o perfil.

### Roteiro para conferir tudo

1. Clique em **Criar usuário**. Escolha **Doador / Empresa**, **Doador / Pessoa física** ou **ONG**. Os campos mudam conforme o perfil.
2. Valide os campos obrigatórios, CPF, CNPJ, e-mail, telefone, senha (mínimo 8 caracteres) e confirmação.
3. Ao criar uma conta, aparece **Pendente de aprovação**; o usuário não pode publicar nem reservar antes de ser aprovado.
4. Saia e entre com **doador@demo.com**. Abra **Nova doação**, preencha dados, janela de retirada e aceite o checklist/termo demonstrativo.
5. Publique e confira em **Minhas doações**. Teste o filtro por status e o cancelamento de uma oferta ainda disponível.
6. Saia e entre com **ong@demo.com**. Em **Doações disponíveis**, filtre, pesquise e **reserve** a doação publicada.
7. Em **Minhas reservas**, confirme **Retirada** e depois **Entrega**. Volte à conta doadora e confira os indicadores atualizados.
8. Teste **Modo claro / Modo escuro**. Em **Esqueci minha senha**, a alteração ocorre apenas neste navegador. Use **Restaurar dados de exemplo** para zerar a simulação.

## 4. O que é e o que não é mock

- Os dados estão em `localStorage` do navegador. Eles **permanecem ao recarregar**, mas são isolados por origem/navegador. Não são compartilhados com outras máquinas ou navegadores.
- O cadastro real inicia em `PENDENTE`. **Não há aprovação automática**: somente as duas contas pré-configuradas são `APROVADA` para demonstração. Um administrador real precisará aprovar no backend.
- Não existe API real, envio de e-mails, acesso Google, banco de dados ou autenticação segura. O armazenamento/hashing local serve **somente para prototipagem**. Não utilize dados pessoais reais ou senhas reais.
- O aceite do termo apresentado é apenas um **rascunho de teste**, ainda sujeito à aprovação jurídica. Em produção, a versão aceita e o checklist deverão ser persistidos no backend.
- Regras de autorização, integridade, cancelamento, reserva concorrente, expiração e verificação de identidade deverão ser refeitas de forma segura no backend.

## 5. Organização dos arquivos

```text
prato-conectado/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Navegação + estado da aplicação
│   │   ├── components/
│   │   │   ├── AuthScreens.jsx     # Login/cadastro/pendência/recuperação/demo
│   │   │   └── Workspace.jsx       # Painéis, doações, reservas, wizard
│   │   ├── mock/store.js           # Mock de usuários/doações/localStorage
│   │   ├── utils/formularios.js    # Validações e máscaras
│   │   └── index.css              # Identidade visual e responsividade
│   ├── tests/mock.test.mjs        # Testes de lógica
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── .dockerignore
│   ├── package.json
│   └── package-lock.json
└── docker-compose.frontend.yml
```

As versões anteriores `CadastroDoador.jsx`, `CadastroDoador.css` e seus utilitários originais estão preservadas para facilitar a comparação com o código que você mandou.

## 6. Verificações

```bash
cd frontend
npm run test
npm run lint
npm run build
```

A suíte Node de mock testa validações, login, estado pendente, publicação, reserva, retirada e entrega. A compilação e o lint dependem de instalação das dependências npm.

## 7. Integração futura com FastAPI

A integração real deverá substituir as operações de `frontend/src/mock/store.js` por chamadas ao serviço de autenticação, organizações e doações do seu backend. O backend deve controlar a sessão/token, validar dados e CNPJ/CPF, confirmar aprovação, checar permissões, persistir ofertas e reservar transacionalmente. **Não basta mudar `VITE_MOCK_MODE`**: esta entrega é intencionalmente só mock; as chamadas HTTP serão implementadas na próxima etapa.

Durante o desenvolvimento conjunto, deixe `docker-compose.frontend.yml` separado do `docker-compose.yml` existente até a equipe decidir nomes de serviços, portas, URLs e política de CORS. Isso evita substituir ou quebrar o Compose do backend.


## Ajustes de layout (26/10/2026)

- A seção vermelha permanece fixa e centralizada verticalmente durante login e cadastro.
- Apenas o painel direito rola quando o formulário é comprido.
- A logo é a imagem fornecida pela equipe (`frontend/src/assets/logo-prato-conectado.png`), não uma reprodução em CSS.
- Em telas estreitas, a identidade visual vira uma faixa superior compacta e fixa; o formulário abaixo continua rolável.
- A alternância de tema fica fora da área rolável para permanecer acessível.

Para aplicar em uma cópia da entrega anterior, substitua `src/components/AuthScreens.jsx`, `src/index.css` e adicione o novo arquivo em `src/assets/`.
