import { limparCnpj } from "../utils/validacoes";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const USAR_MOCK = import.meta.env.VITE_MOCK_CADASTRO === "true";

/**
 * Contrato provisório, a alinhar com o backend FastAPI.
 * Endpoint sugerido: POST /api/organizacoes
 * Payload: { nome, cnpj, endereco, contato, tipo: 'DOADOR' }
 * Resposta esperada: { status: 'PENDENTE', ... }
 * O status NÃO é enviado: cabe ao backend atribuí-lo.
 */
export async function cadastrarDoador(dados) {
  const payload = {
    nome: dados.nome.trim(),
    cnpj: limparCnpj(dados.cnpj),
    endereco: dados.endereco.trim(),
    contato: dados.contato.trim(),
    tipo: "DOADOR",
  };

  if (USAR_MOCK) {
    // Desenvolvimento visual apenas: nenhuma informação é persistida.
    return { status: "PENDENTE", simulado: true };
  }

  let resposta;
  try {
    resposta = await fetch(`${API_URL}/api/organizacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Tente novamente.");
  }

  let corpo = {};
  try {
    corpo = await resposta.json();
  } catch {
    // Alguns endpoints podem responder sem corpo JSON.
  }

  if (!resposta.ok) {
    if (resposta.status === 409) {
      throw new Error("Já existe um cadastro com este CNPJ.");
    }
    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error("Faça login para concluir o cadastro.");
    }
    if (resposta.status === 422) {
      throw new Error("Alguns dados não foram aceitos. Confira o formulário.");
    }
    throw new Error("Não foi possível enviar o cadastro. Tente novamente.");
  }

  return { ...corpo, simulado: false };
}
