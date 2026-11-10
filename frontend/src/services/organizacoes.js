/** Protótipo legado, fora da navegação atual. Cadastro real: services/auth.js. */
const USAR_MOCK = import.meta.env?.VITE_MOCK_CADASTRO === 'true';

export async function cadastrarDoador() {
  if (!USAR_MOCK) {
    throw new Error('Esta tela de cadastro é legada. Use Criar usuário na tela de login para cadastrar pela API.');
  }
  // Demonstração visual: não envia nem persiste dados.
  return { status: 'PENDENTE', simulado: true };
}
