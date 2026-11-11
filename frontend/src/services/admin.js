import { requisicaoApi } from './auth.js';

export function listarCadastros({ status = 'PENDENTE', perfil = '', busca = '', pagina = 1 } = {}) {
  const params = new URLSearchParams({ status, busca, pagina: String(pagina), tamanho: '20' });
  if (perfil) params.set('perfil', perfil);
  return requisicaoApi(`/api/admin/cadastros?${params}`, { autenticada: true });
}
export function detalharCadastro(perfil, id) {
  return requisicaoApi(`/api/admin/cadastros/${perfil}/${id}`, { autenticada: true });
}
export function decidirCadastro(perfil, id, decisao, justificativa) {
  return requisicaoApi(`/api/admin/cadastros/${perfil}/${id}/decisao`, {
    autenticada: true, method: 'POST', payload: { decisao, justificativa: justificativa.trim() || null },
  });
}
