import { dataLocal, dataMaisDias } from '../utils/formularios.js';
const CHAVE = 'prato_conectado_mock_v3';
const SESSAO = 'prato_conectado_sessao_v3';

function gerarId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function salvar(db) { localStorage.setItem(CHAVE, JSON.stringify(db)); return db; }
function banco() {
  const raw = localStorage.getItem(CHAVE);
  if (!raw) throw new Error('Dados não inicializados. Recarregue a página.');
  return JSON.parse(raw);
}
function publico(conta) {
  if (!conta) return null;
  const { senhaHash: _hash, sal: _salt, ...outros } = conta;
  void _hash; void _salt;
  return outros;
}
async function hash(senha, sal) {
  if (!globalThis.crypto?.subtle) throw new Error('Acesse o mock em localhost ou HTTPS para usar a autenticação de demonstração.');
  const bytes = new TextEncoder().encode(`${sal}:${senha}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
async function prepararConta(info, senha) {
  const sal = gerarId();
  return { ...info, id: gerarId(), sal, senhaHash: await hash(senha, sal), criadoEm: new Date().toISOString() };
}
export async function iniciarMock() {
  if (localStorage.getItem(CHAVE)) return;
  const demoDoador = await prepararConta({
    nome: 'Padaria Conectada', tipo: 'DOADOR', perfil: 'EMPRESA', cnpj: '11222333000181',
    endereco: 'Rua das Flores, 120, Arapiraca - AL', telefone: '(82) 99999-9999',
    responsavel: 'Carlos Silva', cpf: '52998224725', email: 'doador@demo.com', status: 'APROVADA', demo: true,
  }, 'Teste@123');
  const demoOng = await prepararConta({
    nome: 'ONG Mãos Solidárias', tipo: 'ONG', perfil: 'ONG', cnpj: '11222333000181',
    capacidade: 100, endereco: 'Rua da Esperança, 85, Arapiraca - AL', telefone: '(82) 98888-8888',
    responsavel: 'Maria Oliveira', cpf: '52998224725', email: 'ong@demo.com', status: 'APROVADA', demo: true,
  }, 'Teste@123');
  salvar({ versao: 3, usuarios: [demoDoador, demoOng], doacoes: [] });
}
export function usuarioAtual() {
  const id = localStorage.getItem(SESSAO);
  return publico(banco().usuarios.find(u => u.id === id));
}
export async function autenticar(email, senha) {
  const conta = banco().usuarios.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!conta || (await hash(senha, conta.sal)) !== conta.senhaHash) throw new Error('E-mail ou senha incorretos.');
  localStorage.setItem(SESSAO, conta.id);
  return publico(conta);
}
export async function acessarDemo(tipo) {
  const email = tipo === 'ONG' ? 'ong@demo.com' : 'doador@demo.com';
  return autenticar(email, 'Teste@123');
}
export function encerrarSessao() { localStorage.removeItem(SESSAO); }
export async function registrar(info) {
  const db = banco();
  const email = info.email.trim().toLowerCase();
  if (db.usuarios.some(u => u.email === email)) throw new Error('Este e-mail já está cadastrado.');
  if (db.usuarios.some(u => !u.demo && u.cpf === info.cpf.replace(/\D/g, ''))) throw new Error('Este CPF já está cadastrado.');
  if (info.cnpj && db.usuarios.some(u => !u.demo && u.cnpj === info.cnpj.replace(/[^A-Z0-9]/gi, ''))) throw new Error('Este CNPJ já está cadastrado.');
  const novo = await prepararConta({
    tipo: info.tipo, perfil: info.tipo === 'ONG' ? 'ONG' : info.perfil, nome: info.nome.trim(),
    cnpj: info.tipo === 'ONG' || info.perfil === 'EMPRESA' ? info.cnpj.replace(/[^A-Z0-9]/gi, '').toUpperCase() : '',
    capacidade: info.tipo === 'ONG' ? Number(info.capacidade) : undefined,
    endereco: info.endereco.trim(), telefone: info.telefone.trim(), responsavel: info.responsavel.trim(),
    cpf: info.cpf.replace(/\D/g, ''), email, status: 'PENDENTE', demo: false,
  }, info.senha);
  db.usuarios.push(novo); salvar(db);
  localStorage.setItem(SESSAO, novo.id);
  return publico(novo);
}
export async function redefinirSenha(email, novaSenha) {
  const db = banco();
  const conta = db.usuarios.find(u => u.email === email.trim().toLowerCase());
  if (!conta) throw new Error('E-mail não encontrado nesta simulação.');
  conta.sal = gerarId(); conta.senhaHash = await hash(novaSenha, conta.sal);
  salvar(db);
}
export function listarDoacoes() { return banco().doacoes.map(d => ({ ...d })); }
export function novaDoacao(usuario, data) {
  if (!usuario || usuario.tipo !== 'DOADOR' || usuario.status !== 'APROVADA') throw new Error('Somente doadores aprovados podem publicar.');
  const db = banco();
  const registro = {
    ...data, id: gerarId(), doadorId: usuario.id, doadorNome: usuario.nome, status: 'DISPONIVEL',
    publicadoEm: new Date().toISOString(), ongId: null, ongNome: null,
  };
  db.doacoes.unshift(registro); salvar(db); return registro;
}
export function mudarStatusDoacao(id, usuario, acao) {
  const db = banco();
  const d = db.doacoes.find(x => x.id === id);
  if (!d) throw new Error('Doação não encontrada.');
  if (acao === 'CANCELAR') {
    if (usuario.id !== d.doadorId || d.status !== 'DISPONIVEL') throw new Error('Somente doações disponíveis podem ser canceladas pelo doador.');
    d.status = 'CANCELADA';
  } else if (acao === 'RESERVAR') {
    if (usuario.tipo !== 'ONG' || usuario.status !== 'APROVADA' || d.status !== 'DISPONIVEL') throw new Error('Esta doação não está disponível para reserva.');
    if (d.retiradaData < dataLocal()) throw new Error('O período de retirada já passou.');
    d.status = 'RESERVADA'; d.ongId = usuario.id; d.ongNome = usuario.nome;
  } else if (acao === 'RETIRAR' || acao === 'ENTREGAR') {
    if (usuario.id !== d.ongId) throw new Error('Esta doação não está reservada pela sua ONG.');
    if (acao === 'RETIRAR' && d.status === 'RESERVADA') d.status = 'RETIRADA';
    else if (acao === 'ENTREGAR' && d.status === 'RETIRADA') d.status = 'ENTREGUE';
    else throw new Error('Ação indisponível para o estado atual da doação.');
  } else throw new Error('Ação inválida.');
  salvar(db); return d;
}
export async function restaurarMock() {
  encerrarSessao(); localStorage.removeItem(CHAVE); await iniciarMock();
}
export const dadosDemo = { doador: 'doador@demo.com', ong: 'ong@demo.com', senha: 'Teste@123' };
export const sugestaoRetirada = () => dataMaisDias(1);
