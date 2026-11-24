import { ESTADOS } from './cadastro.js';
import { emailValido, formatarCep, formatarTelefone, telefoneValido } from './formularios.js';

export const CAMPOS_VOLUNTARIO = [
  { nome: 'nome', rotulo: 'Nome completo', limite: 160, autoComplete: 'name' },
  { nome: 'telefone', rotulo: 'Telefone com DDD', limite: 15, tipo: 'tel', mascara: formatarTelefone, autoComplete: 'tel-national', exemplo: '(82) 99999-1234' },
  { nome: 'email', rotulo: 'E-mail (opcional)', limite: 255, tipo: 'email', autoComplete: 'email' },
  { nome: 'logradouro', rotulo: 'Logradouro', limite: 180, autoComplete: 'address-line1' },
  { nome: 'numero', rotulo: 'Número', limite: 15, exemplo: '10 ou s/n' },
  { nome: 'bairro', rotulo: 'Bairro', limite: 100, autoComplete: 'address-level3' },
  { nome: 'cidade', rotulo: 'Cidade', limite: 120, autoComplete: 'address-level2' },
  { nome: 'cep', rotulo: 'CEP', limite: 9, mascara: formatarCep, inputMode: 'numeric', autoComplete: 'postal-code', exemplo: '57300-000' },
];

export function validarVoluntario(dados) {
  const erros = {};
  for (const { nome, rotulo, limite } of CAMPOS_VOLUNTARIO) {
    if (!dados[nome] && nome !== 'email') erros[nome] = `Preencha o campo ${rotulo}.`;
    else if (dados[nome]?.length > limite) erros[nome] = `Limite de ${limite} caracteres.`;
  }
  if (!erros.telefone && !telefoneValido(dados.telefone)) erros.telefone = 'Informe um telefone com DDD válido.';
  if (!erros.cep && !/^\d{5}-?\d{3}$/.test(dados.cep)) erros.cep = 'Informe um CEP com 8 dígitos.';
  if (!erros.email && dados.email && !emailValido(dados.email)) erros.email = 'Informe um e-mail válido.';
  if (!ESTADOS.includes(dados.uf)) erros.uf = 'Selecione uma UF válida.';
  return erros;
}
