import { cnpjValido, formatarCnpj } from './validacoes.js';

export { cnpjValido, formatarCnpj };
export const somenteDigitos = (value = '') => String(value).replace(/\D/g, '');
export const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
export const dataLocal = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
export const dataMaisDias = (days) => {
  const date = new Date(); date.setDate(date.getDate() + days); return dataLocal(date);
};
export const formatarCpf = (v) => {
  const x = somenteDigitos(v).slice(0, 11);
  return x.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};
export const cpfValido = (v) => {
  const x = somenteDigitos(v);
  if (x.length !== 11 || /^(\d)\1{10}$/.test(x)) return false;
  const check = (n) => {
    const sum = [...x.slice(0, n)].reduce((a, digit, i) => a + Number(digit) * (n + 1 - i), 0);
    const rem = 11 - (sum % 11);
    return rem > 9 ? 0 : rem;
  };
  return check(9) === Number(x[9]) && check(10) === Number(x[10]);
};
export const formatarTelefone = (v) => {
  const x = somenteDigitos(v).slice(0, 11);
  if (x.length <= 2) return x ? `(${x}` : '';
  if (x.length <= 6) return `(${x.slice(0, 2)}) ${x.slice(2)}`;
  if (x.length <= 10) return `(${x.slice(0, 2)}) ${x.slice(2, 6)}-${x.slice(6)}`;
  return `(${x.slice(0, 2)}) ${x.slice(2, 7)}-${x.slice(7)}`;
};
export const telefoneValido = (v) => /^[1-9]\d{9,10}$/.test(somenteDigitos(v));
export const formatarData = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
  const [a, m, d] = value.split('-'); return `${d}/${m}/${a}`;
};
export const campoRequired = (value) => String(value ?? '').trim().length > 0;
export const validarRegistro = (v) => {
  const e = {};
  if (!campoRequired(v.nome)) e.nome = 'Informe o nome da organização ou empresa.';
  if (!campoRequired(v.endereco)) e.endereco = 'Informe o endereço completo.';
  if (!telefoneValido(v.telefone)) e.telefone = 'Informe um telefone válido com DDD.';
  if (!campoRequired(v.responsavel)) e.responsavel = 'Informe o nome do responsável.';
  if (!cpfValido(v.cpf)) e.cpf = 'Informe um CPF válido.';
  if (!emailValido(v.email)) e.email = 'Informe um e-mail válido.';
  if ((v.senha || '').length < 8) e.senha = 'A senha precisa ter pelo menos 8 caracteres.';
  if (v.confirmacao !== v.senha) e.confirmacao = 'As senhas não coincidem.';
  if (v.tipo === 'ONG' || v.perfil === 'EMPRESA') {
    if (!cnpjValido(v.cnpj)) e.cnpj = 'Informe um CNPJ válido.';
  }
  if (v.tipo === 'ONG' && (!Number.isInteger(Number(v.capacidade)) || Number(v.capacidade) <= 0)) {
    e.capacidade = 'A capacidade deve ser maior que zero.';
  }
  return e;
};
export const validarDoacao = (v, passo) => {
  const e = {};
  if (passo === 1) {
    if (!v.categoria) e.categoria = 'Selecione a categoria.';
    if (!campoRequired(v.descricao)) e.descricao = 'Descreva o alimento.';
    if (!Number.isFinite(Number(v.quantidade)) || Number(v.quantidade) <= 0) e.quantidade = 'Informe uma quantidade maior que zero.';
    if (!v.unidade) e.unidade = 'Selecione uma unidade.';
    if (!v.validade || v.validade < dataLocal()) e.validade = 'Informe uma data de validade atual ou futura.';
  }
  if (passo === 2) {
    if (!v.retiradaData || v.retiradaData < dataLocal()) e.retiradaData = 'A retirada não pode estar no passado.';
    if (v.validade && v.retiradaData > v.validade) e.retiradaData = 'A retirada não pode ser após a validade.';
    if (!v.retiradaInicio) e.retiradaInicio = 'Informe o horário inicial.';
    if (!v.retiradaFim || (v.retiradaInicio && v.retiradaInicio >= v.retiradaFim)) e.retiradaFim = 'O horário final deve ser posterior ao inicial.';
    if (v.retiradaData === dataLocal() && v.retiradaInicio && v.retiradaInicio <= new Date().toTimeString().slice(0, 5)) {
      e.retiradaInicio = 'Para hoje, escolha um horário futuro.';
    }
  }
  if (passo === 3 && !Object.values(v.checklist || {}).every(Boolean)) e.checklist = 'Marque todos os itens, inclusive o aceite do termo.';
  return e;
};
