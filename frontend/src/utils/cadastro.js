import { cnpjValido } from './validacoes.js';
import { cpfValido, emailValido, telefoneValido, somenteDigitos } from './formularios.js';

export const FORM_INICIAL = {
  tipo: 'DOADOR', perfil: 'EMPRESA', nome: '', cnpj: '', cpf: '', capacidade: '',
  email_contato: '', telefone: '', logradouro: '', numero: '', complemento: '',
  bairro: '', cidade: '', uf: '', cep: '', responsavel: '', email: '', senha: '', confirmacao: '',
};
export const ESTADOS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export function validarFormularioCadastro(form, perfilGoogle = false) {
  const erros = {};
  const ong = form.tipo === 'ONG';
  const pessoa = !ong && form.perfil === 'PESSOA_FISICA';
  const obrigatorio = (key, rotulo, max) => {
    const v = String(form[key] ?? '').trim();
    if (!v) erros[key] = `Informe ${rotulo}.`;
    else if (max && v.length > max) erros[key] = `Limite de ${max} caracteres.`;
  };
  obrigatorio('nome', pessoa ? 'seu nome' : 'o nome da organização', 180);
  if (pessoa) {
    if (!cpfValido(form.cpf)) erros.cpf = 'Informe um CPF válido.';
  } else if (!cnpjValido(form.cnpj)) erros.cnpj = 'Informe um CNPJ válido (inclusive alfanumérico).';
  if (!emailValido(form.email_contato) || form.email_contato.length > 255) erros.email_contato = 'Informe um e-mail de contato válido.';
  if (!telefoneValido(form.telefone)) erros.telefone = 'Informe um telefone com DDD válido.';
  obrigatorio('logradouro', 'o logradouro', 180);
  obrigatorio('numero', 'o número (ou s/n)', 15);
  if (form.complemento.trim().length > 120) erros.complemento = 'Limite de 120 caracteres.';
  obrigatorio('bairro', 'o bairro', 100);
  obrigatorio('cidade', 'a cidade', 120);
  if (!ESTADOS.includes(form.uf.toUpperCase())) erros.uf = 'Selecione uma UF válida.';
  if (somenteDigitos(form.cep).length !== 8) erros.cep = 'Informe um CEP com 8 dígitos.';
  if (ong && (!/^\d+$/.test(String(form.capacidade)) || Number(form.capacidade) < 1 || Number(form.capacidade) > 2147483647)) {
    erros.capacidade = 'Informe uma capacidade inteira e positiva.';
  }
  if (!perfilGoogle) {
    obrigatorio('responsavel', 'o nome do responsável', 160);
    if (!emailValido(form.email) || form.email.length > 255) erros.email = 'Informe um e-mail de acesso válido.';
    if (form.senha.length < 8 || form.senha.length > 256 || !form.senha.trim()) erros.senha = 'A senha deve ter de 8 a 256 caracteres.';
    if (form.senha !== form.confirmacao) erros.confirmacao = 'As senhas não coincidem.';
  }
  return erros;
}
