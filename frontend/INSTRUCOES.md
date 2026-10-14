# Cadastro de Doador — Prato Conectado (Frontend React)

## O que foi entregue

- Tela em React com quatro campos obrigatórios e layout responsivo.
- CNPJ numérico e alfanumérico com máscara e dígitos verificadores.
- Validação de nome, endereço e telefone com DDD ou e-mail.
- Erros de formulário, erros de API, bloqueio de envio duplicado e estado de carregamento.
- Confirmação visual com status `PENDENTE` quando retornado pela API.
- Modo de simulação claramente identificado, sem persistência de dados.

## Como integrar ao repositório existente

1. Copie os arquivos de `frontend/src` deste ZIP para as pastas equivalentes do seu repositório.
2. Não sobrescreva seu `App.jsx`: apenas importe a nova página e adicione a rota apropriada.
3. Crie `frontend/.env.local` copiando as variáveis de `frontend/.env.example.cadastro`.
4. Execute `npm install` (se ainda não fez) e `npm run dev` dentro da pasta `frontend`.

### Testar sem backend

Mantenha `VITE_MOCK_CADASTRO=true` no `.env.local`.

O modo mock mostra confirmação de simulação, mas NÃO cadastra o doador nem persiste o status.

### Integrar com backend depois

1. Altere para `VITE_MOCK_CADASTRO=false`.
2. Configure `VITE_API_URL=http://localhost:8000` (ou a URL real da API).
3. Revise `src/services/organizacoes.js` com o responsável pelo backend. A rota `/api/organizacoes` e o formato do payload são PROPOSTAS, não contratos confirmados nos arquivos fornecidos.
4. Se o login Google da HU01 exigir token ou cookie, alinhe o transporte de autenticação com o time de backend.
5. Confirme que a API devolve status `PENDENTE` e que o backend define esse status ao persistir (nunca confie em um status enviado pelo navegador).
6. Configure CORS no backend para a origem do frontend quando necessário.

### Exemplo de integração simples (apenas ilustrativo)

No `frontend/src/App.jsx`, se você ainda não usa rotas:

```jsx
import CadastroDoador from "./pages/CadastroDoador";

export default function App() {
  return <CadastroDoador />;
}
```

Se o projeto JÁ usa React Router, adicione a rota sem substituir as demais:

```jsx
import CadastroDoador from "./pages/CadastroDoador";

<Route path="/cadastro-doador" element={<CadastroDoador />} />
```

## Critérios de aceite e testes manuais

1. Abrir o formulário e tentar enviar tudo vazio → campos apresentam erro.
2. Preencher CNPJ com dígito incorreto → erro no campo.
3. Preencher CNPJ antigo `11.222.333/0001-81` → aceita o formato.
4. Preencher CNPJ alfanumérico de exemplo público `00.000.000/E08G-12` → aceita o formato.
5. Preencher contato com e-mail inválido ou telefone sem DDD → erro.
6. Corrigir os campos e enviar em modo mock → confirmação diz que é simulação e nenhum dado foi persistido.
7. Com API ligada, sucesso (HTTP 2xx) com status PENDENTE → confirmação correspondente.
8. Com API ligada, resposta HTTP 409 → mensagem de CNPJ já cadastrado.
9. Com API indisponível → erro, formulário preservado para nova tentativa.
10. Verificar layout em desktop e celular.

## Observação de escopo

Frontend apenas. Este pacote não cria endpoints, não configura banco, não implementa OAuth, não aprova organizações e não altera os arquivos existentes do projeto além dos novos arquivos que você copiar.
