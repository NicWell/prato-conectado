import test from 'node:test';
import assert from 'node:assert/strict';
import { validarFormularioCadastro, FORM_INICIAL } from '../src/utils/cadastro.js';
import { montarCadastro, montarPerfil, interpretarErro } from '../src/services/auth.js';
const base = {
  ...FORM_INICIAL,
  nome: 'Padaria Teste', tipo: 'DOADOR', perfil: 'EMPRESA', cnpj: '11.222.333/0001-81',
  email_contato: 'Contato@teste.com', telefone: '(82) 99999-9999',
  logradouro: 'Rua A', numero: 's/n', complemento: '', bairro: 'Centro', cidade: 'Arapiraca',
  uf: 'AL', cep: '57300-000', responsavel: 'Maria Lima', email: 'Maria@teste.com',
  senha: 'Teste@123', confirmacao: 'Teste@123',
};
test('cadastro de empresa gera payload permitido sem campos extras', () => {
  assert.deepEqual(validarFormularioCadastro(base), {});
  const payload = montarCadastro(base);
  assert.equal(payload.cnpj, '11222333000181');
  assert.equal(payload.email, 'maria@teste.com');
  assert.equal(payload.email_contato, 'contato@teste.com');
  assert.equal(payload.cep, '57300000');
  for (const x of ['cpf', 'capacidade_atendimento', 'confirmacao', 'endereco', 'status', 'ativo', 'google_sub']) assert.ok(!(x in payload), `campo indevido: ${x}`);
});
test('ONG envia capacidade positiva, mas não CPF', () => {
  const dados = { ...base, tipo: 'ONG', perfil: 'ONG', capacidade: '150' };
  assert.deepEqual(validarFormularioCadastro(dados), {});
  const payload = montarCadastro(dados);
  assert.equal(payload.capacidade_atendimento, 150);
  assert.equal(payload.perfil, 'ONG');
  assert.ok(!('cpf' in payload));
});
test('Pessoa física exige somente CPF e omite CNPJ/capacidade', () => {
  const dados = { ...base, tipo: 'DOADOR', perfil: 'PESSOA_FISICA', cpf: '529.982.247-25', cnpj: '' };
  assert.deepEqual(validarFormularioCadastro(dados), {});
  const payload = montarCadastro(dados);
  assert.equal(payload.cpf, '52998224725');
  assert.ok(!('cnpj' in payload));
  assert.ok(!('capacidade_atendimento' in payload));
});
test('primeiro acesso Google omite dados do login local', () => {
  const payload = montarPerfil({ ...base, tipo: 'DOADOR', perfil: 'PESSOA_FISICA', cpf: '529.982.247-25' });
  for (const x of ['email', 'senha', 'confirmacao', 'responsavel', 'cnpj']) assert.ok(!(x in payload));
  assert.deepEqual(validarFormularioCadastro({ ...base, perfil: 'PESSOA_FISICA', cpf: '529.982.247-25', senha: '', confirmacao: '' }, true), {});
});
test('formulários inválidos apontam os campos', () => {
  const erros = validarFormularioCadastro({ ...base, tipo: 'ONG', capacidade: '', cep: '44', cnpj: '', senha: 'abc' });
  for (const x of ['capacidade', 'cep', 'cnpj', 'senha']) assert.ok(erros[x], `faltou ${x}`);
});
test('422 do FastAPI mapeia erros de campo e de body', () => {
  const err = interpretarErro(422, { detail: [
    { loc: ['body','capacidade_atendimento'], msg: 'Maior que 0' },
    { loc: ['body'], msg: 'Combinação inválida' },
  ] });
  assert.equal(err.status, 422);
  assert.equal(err.fields.capacidade, 'Maior que 0');
  assert.equal(err.message, 'Combinação inválida');
});
test('erro Google preserva código e mensagem para vinculação', () => {
  const e = interpretarErro(409, { detail: { codigo: 'VINCULACAO_NECESSARIA', mensagem: 'Entre com senha para vincular.' } });
  assert.equal(e.codigo, 'VINCULACAO_NECESSARIA');
  assert.equal(e.message, 'Entre com senha para vincular.');
});
