/** HTTP e sessão do frontend. Não confundir o ID token Google com o JWT da API. */
const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const USAR_API_AUTH = import.meta.env?.VITE_AUTH_MODE === 'api';
export const GOOGLE_CLIENT_ID = (import.meta.env?.VITE_GOOGLE_CLIENT_ID || '').trim();
const TOKEN_KEY = 'prato_conectado_api_access_token';
const USER_KEY = 'prato_conectado_api_user';

export class ApiError extends Error {
  constructor(message, status = 0, fields = {}, codigo = '') {
    super(message);
    this.name = 'ApiError'; this.status = status; this.fields = fields; this.codigo = codigo;
  }
}
const CAMPOS_API = { capacidade_atendimento: 'capacidade', email_contato: 'email_contato' };
export function interpretarErro(status, corpo = {}) {
  const detail = corpo?.detail;
  const fields = {};
  let mensagem = '';
  let codigo = '';
  if (Array.isArray(detail)) {
    for (const erro of detail) {
      const local = Array.isArray(erro.loc) ? erro.loc.filter(x => x !== 'body' && typeof x === 'string') : [];
      const campo = local[local.length - 1];
      if (campo) fields[CAMPOS_API[campo] || campo] = erro.msg;
      else if (!mensagem) mensagem = erro.msg;
    }
    mensagem ||= Object.keys(fields).length ? 'Revise os campos indicados abaixo.' : 'Os dados enviados não são válidos.';
  } else if (typeof detail === 'string') mensagem = detail;
  else if (detail && typeof detail === 'object') {
    mensagem = detail.mensagem || 'Não foi possível concluir a operação.';
    codigo = detail.codigo || '';
  }
  if (!mensagem) mensagem = status === 401 ? 'Sessão expirada ou credenciais inválidas.' : status === 409 ? 'Já existe um cadastro com estes dados.' : 'Falha na comunicação com a API.';
  return new ApiError(mensagem, status, fields, codigo);
}

export function logoutApi() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('prato:sessao-alterada'));
}
function guardarUsuario(usuario) { sessionStorage.setItem(USER_KEY, JSON.stringify(usuario)); }
function guardarSessao(data) {
  if (!data?.access_token || !data?.usuario) throw new ApiError('Resposta de sessão inválida do servidor.');
  sessionStorage.setItem(TOKEN_KEY, data.access_token);
  guardarUsuario(data.usuario);
  window.dispatchEvent(new Event('prato:sessao-alterada'));
  return data.usuario;
}
export function usuarioSessaoApi() {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
  catch { logoutApi(); return null; }
}

export async function requisicaoApi(path, { method = 'GET', payload, autenticada = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (autenticada) {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      logoutApi();
      window.dispatchEvent(new Event('prato:sessao-expirada'));
      throw new ApiError('Entre novamente para continuar.', 401);
    }
    headers.Authorization = `Bearer ${token}`;
  }
  let resposta;
  try {
    resposta = await fetch(`${API_URL}${path}`, { method, headers, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}) });
  } catch {
    throw new ApiError('Não foi possível conectar à API. Verifique se o backend está funcionando.');
  }
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = interpretarErro(resposta.status, corpo);
    // Erro de senha/ID token/desafio Google não significa que o JWT local expirou.
    const falhaGoogleDaTentativa = ['SENHA_INVALIDA', 'DESAFIO_INVALIDO', 'TOKEN_GOOGLE_INVALIDO'].includes(erro.codigo);
    if (resposta.status === 401 && autenticada && !falhaGoogleDaTentativa) {
      logoutApi();
      window.dispatchEvent(new Event('prato:sessao-expirada'));
    }
    throw erro;
  }
  return corpo;
}

export async function loginApi(email, senha) {
  const data = await requisicaoApi('/api/auth/login', { method: 'POST', payload: { email: email.trim(), senha } });
  return guardarSessao(data);
}
export async function cadastrarApi(form) {
  const data = await requisicaoApi('/api/auth/cadastro', { method: 'POST', payload: montarCadastro(form) });
  return guardarSessao(data);
}
export function montarPerfil(form) {
  const ong = form.tipo === 'ONG';
  const empresa = ong || form.perfil === 'EMPRESA';
  const perfil = ong ? 'ONG' : form.perfil;
  return {
    tipo: form.tipo, perfil,
    nome: form.nome.trim(),
    ...(empresa ? { cnpj: form.cnpj.replace(/[^A-Z0-9]/gi, '').toUpperCase() } : { cpf: form.cpf.replace(/\D/g, '') }),
    email_contato: form.email_contato.trim().toLowerCase(),
    telefone: form.telefone.replace(/\D/g, ''),
    logradouro: form.logradouro.trim(), numero: form.numero.trim(),
    complemento: form.complemento.trim() || null, bairro: form.bairro.trim(),
    cidade: form.cidade.trim(), uf: form.uf.trim().toUpperCase(), cep: form.cep.replace(/\D/g, ''),
    ...(ong ? { capacidade_atendimento: Number(form.capacidade) } : {}),
  };
}
export function montarCadastro(form) {
  return { ...montarPerfil(form), responsavel: form.responsavel.trim(), email: form.email.trim().toLowerCase(), senha: form.senha };
}
export async function completarPerfilApi(form) {
  const usuario = await requisicaoApi('/api/auth/perfil', { method: 'POST', autenticada: true, payload: montarPerfil(form) });
  guardarUsuario(usuario);
  window.dispatchEvent(new Event('prato:sessao-alterada'));
  return usuario;
}
export async function validarSessaoApi() {
  if (!sessionStorage.getItem(TOKEN_KEY)) { logoutApi(); return null; }
  try {
    const usuario = await requisicaoApi('/api/auth/me', { autenticada: true });
    guardarUsuario(usuario);
    return usuario;
  } catch (erro) {
    if (erro.status === 401) return null;
    throw erro;
  }
}
export async function desafioGoogleApi(vincular = false) {
  return requisicaoApi(vincular ? '/api/auth/google/vincular/desafio' : '/api/auth/google/desafio', { method: 'POST', ...(vincular ? { autenticada: true } : {}) });
}
export async function loginGoogleApi(desafio_id, id_token) {
  const data = await requisicaoApi('/api/auth/google', { method: 'POST', payload: { desafio_id, id_token } });
  return guardarSessao(data);
}
export async function vincularGoogleApi(desafio_id, id_token, senha_atual) {
  const data = await requisicaoApi('/api/auth/google/vincular', { method: 'POST', autenticada: true, payload: { desafio_id, id_token, senha_atual } });
  return guardarSessao(data);
}
