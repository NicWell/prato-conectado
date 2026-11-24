import { requisicaoApi } from './auth.js';

const caminho = '/api/necessidades';

export function listarNecessidades() {
  return requisicaoApi(caminho, { autenticada: true });
}

export function salvarNecessidade(id, dados) {
  const url = id ? `${caminho}/${encodeURIComponent(id)}` : caminho;
  return requisicaoApi(url, { method: id ? 'PUT' : 'POST', payload: dados, autenticada: true });
}

export function desativarNecessidade(id) {
  return requisicaoApi(`${caminho}/${encodeURIComponent(id)}/desativacao`, {
    method: 'POST', autenticada: true,
  });
}
