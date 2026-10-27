// Autenticação real da API. O restante do frontend continua sendo um protótipo local.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const USAR_API_AUTH = import.meta.env.VITE_AUTH_MODE === 'api';
const TOKEN_KEY = 'prato_conectado_api_access_token';
const USER_KEY = 'prato_conectado_api_user';

function limparSessao() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

async function respostaJson(response) {
  const corpo = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new Error('E-mail ou senha incorretos, ou sessão expirada.');
    throw new Error(typeof corpo.detail === 'string' ? corpo.detail : 'Falha na comunicação com a API.');
  }
  return corpo;
}

export async function loginApi(email, senha) {
  let response;
  try {
    response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), senha }),
    });
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique os containers.');
  }
  const data = await respostaJson(response);
  sessionStorage.setItem(TOKEN_KEY, data.access_token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
  return data.usuario;
}

export function usuarioSessaoApi() {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
  catch { limparSessao(); return null; }
}

export async function validarSessaoApi() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const r = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error('Sessão inválida');
    const usuario = await r.json();
    sessionStorage.setItem(USER_KEY, JSON.stringify(usuario));
    return usuario;
  } catch {
    limparSessao();
    return null;
  }
}

export function logoutApi() { limparSessao(); }
