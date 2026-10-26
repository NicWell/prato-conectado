import test from 'node:test';
import assert from 'node:assert/strict';
import { cnpjValido, cpfValido, validarRegistro, validarDoacao, dataMaisDias } from '../src/utils/formularios.js';
import { iniciarMock, autenticar, registrar, usuarioAtual, listarDoacoes, novaDoacao, mudarStatusDoacao, encerrarSessao, restaurarMock } from '../src/mock/store.js';

const cache = new Map();
globalThis.localStorage = {
  getItem: key => cache.get(key) ?? null,
  setItem: (key, value) => cache.set(key, String(value)),
  removeItem: key => cache.delete(key),
  clear: () => cache.clear(),
};

test('CNPJ e CPF válidos passam nas validações', () => {
  assert.equal(cnpjValido('11.222.333/0001-81'), true);
  assert.equal(cnpjValido('11.111.111/1111-11'), false);
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('111.111.111-11'), false);
});

test('cadastro inválido apresenta erros obrigatórios e CNPJ', () => {
  const erros = validarRegistro({ tipo: 'DOADOR', perfil: 'EMPRESA', nome: '', cnpj: '', endereco: '', telefone: '', responsavel: '', cpf: '', email: '', senha: '', confirmacao: '' });
  assert.ok(erros.nome && erros.cnpj && erros.endereco && erros.telefone && erros.email && erros.cpf && erros.senha);
});

test('campos da doação possuem validação por etapa', () => {
  assert.ok(validarDoacao({ descricao: '', quantidade: '-2', validade: dataMaisDias(-1) }, 1).descricao);
  assert.ok(validarDoacao({ retiradaData: dataMaisDias(1), retiradaInicio: '12:00', retiradaFim: '11:00' }, 2).retiradaFim);
  assert.ok(validarDoacao({ checklist: { a: false } }, 3).checklist);
});

test('fluxo completo mock: contas, pendência, login, publicação e reserva', async () => {
  await iniciarMock();
  assert.equal(listarDoacoes().length, 0);
  await assert.rejects(autenticar('doador@demo.com', 'senhaerrada'), /incorretos/);
  const info = {
    tipo:'DOADOR', perfil:'PESSOA_FISICA', nome:'Joana Silva', cnpj:'',
    endereco:'Rua A 99', telefone:'(82) 99999-8888', responsavel:'Joana Silva', cpf:'529.982.247-25',
    email:'joana@example.org', senha:'Senha@123', confirmacao:'Senha@123',
  };
  assert.deepEqual(validarRegistro(info), {});
  const nova = await registrar(info);
  assert.equal(nova.status, 'PENDENTE');
  assert.equal(usuarioAtual().email, info.email);
  assert.equal('senhaHash' in usuarioAtual(), false);
  assert.throws(() => novaDoacao(nova, {}), /aprovados/);
  encerrarSessao();
  const doador = await autenticar('doador@demo.com','Teste@123');
  assert.equal(doador.tipo, 'DOADOR');
  const registro = novaDoacao(doador, {
    categoria:'Refeições prontas', descricao:'Arroz e feijão', quantidade:5, unidade:'porções',
    validade:dataMaisDias(3), retiradaData:dataMaisDias(1), retiradaInicio:'10:00', retiradaFim:'12:00',
    entrega:'RETIRADA', checklist:{temperatura:true,embalagem:true,validade:true,conservacao:true,termo:true},
  });
  assert.equal(registro.status,'DISPONIVEL');
  const ong = await autenticar('ong@demo.com','Teste@123');
  assert.equal(ong.tipo, 'ONG');
  assert.equal(mudarStatusDoacao(registro.id, ong, 'RESERVAR').status, 'RESERVADA');
  assert.equal(mudarStatusDoacao(registro.id, ong, 'RETIRAR').status, 'RETIRADA');
  assert.equal(mudarStatusDoacao(registro.id, ong, 'ENTREGAR').status, 'ENTREGUE');
  assert.equal(listarDoacoes().length, 1);
  await assert.rejects(autenticar('joana@example.org','wrong'), /incorretos/);
  await restaurarMock();
  assert.equal(listarDoacoes().length, 0);
  assert.equal(usuarioAtual(), null);
});
