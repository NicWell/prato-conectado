import { requisicaoApi } from './auth.js';

const caminho = '/api/voluntarios';

export function listarVoluntarios() {
  return requisicaoApi(caminho, { autenticada: true });
}

export function cadastrarVoluntario(dados) {
  return requisicaoApi(caminho, { method: 'POST', payload: dados, autenticada: true });
}
