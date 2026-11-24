import test from 'node:test';
import assert from 'node:assert/strict';
import { cnpjValido, cpfValido, filtrarOfertas, validarDoacao, dataMaisDias } from '../src/utils/formularios.js';
import { CAMPOS_VOLUNTARIO, validarVoluntario } from '../src/utils/voluntarios.js';
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

test('CNPJ e CPF válidos passam nas validações', () => {
  assert.equal(cnpjValido('11.222.333/0001-81'), true);
  assert.equal(cnpjValido('11.111.111/1111-11'), false);
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('111.111.111-11'), false);
});

test('campos da doação possuem validação por etapa', () => {
  assert.ok(validarDoacao({ descricao: '', quantidade: '-2', validade: dataMaisDias(-1) }, 1).descricao);
  assert.ok(validarDoacao({ retiradaData: dataMaisDias(1), retiradaInicio: '12:00', retiradaFim: '11:00' }, 2).retiradaFim);
  assert.ok(validarDoacao({ checklist: { a: false } }, 3).checklist);
});

test('filtros combinam categoria, quantidade na mesma unidade e validade inclusiva', () => {
  const oferta = { categoria: 'Frutas', quantidade: '2.500', unidade: 'kg', validade: '2026-11-26', descricao: 'Maçãs', doadorNome: 'Feira' };
  const ofertas = [
    oferta,
    { ...oferta, unidade: 'caixas' },
    { ...oferta, quantidade: '2.499' },
    { ...oferta, validade: '2026-11-25' },
    { ...oferta, categoria: 'Outros' },
  ];
  const filtros = { categoria: 'Frutas', quantidade: '2.5', unidade: 'kg', validade: '2026-11-26', busca: ' FEIRA ' };
  assert.deepEqual(filtrarOfertas(ofertas, filtros), [oferta]);
  assert.deepEqual(filtrarOfertas(ofertas, { ...filtros, quantidade: '' }), ofertas.slice(0, 3));
});

test('máscaras do voluntário limitam telefone e CEP', () => {
  const telefone = CAMPOS_VOLUNTARIO.find(campo => campo.nome === 'telefone');
  const cep = CAMPOS_VOLUNTARIO.find(campo => campo.nome === 'cep');
  assert.equal(telefone.mascara('8233331234'), '(82) 3333-1234');
  assert.equal(telefone.mascara('8299999123499'), '(82) 99999-1234');
  assert.equal(cep.mascara('5730000099'), '57300-000');
});

test('cadastro de voluntário valida contato, endereço e limites por campo', () => {
  const dados = {
    nome: 'Ana da Silva', telefone: '(82) 99999-1234', email: '',
    logradouro: 'Rua das Flores', numero: 's/n', bairro: 'Centro',
    cidade: 'Arapiraca', uf: 'AL', cep: '57300-000',
  };
  assert.deepEqual(validarVoluntario(dados), {});
  const erros = validarVoluntario({
    ...dados, telefone: '(82) 99', cep: '57300-00', uf: 'XX', email: 'invalido',
    nome: '', logradouro: 'a'.repeat(181), numero: '', bairro: '', cidade: '',
  });
  assert.deepEqual(Object.keys(erros).sort(),
    ['bairro', 'cep', 'cidade', 'email', 'logradouro', 'nome', 'numero', 'telefone', 'uf']);
});
