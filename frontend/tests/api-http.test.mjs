import test from 'node:test';
import assert from 'node:assert/strict';
import { cadastrarApi, completarPerfilApi, loginApi, loginGoogleApi, logoutApi, requisicaoApi, usuarioSessaoApi, validarSessaoApi, vincularGoogleApi } from '../src/services/auth.js';

class MemoryStorage {
  map = new Map();
  setItem(k,v){ this.map.set(k,String(v)); }
  getItem(k){ return this.map.get(k) ?? null; }
  removeItem(k){ this.map.delete(k); }
  clear(){this.map.clear();}
}
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = { dispatchEvent: () => {} };
const usuario = { id: 'org-1', usuario_id: 'user-1', nome: 'ONG Exemplo', tipo: 'ONG', perfil: 'ONG', status: 'PENDENTE', cadastro_completo: true, google_vinculado: false };
function instalarFetch(retorno) {
  const chamadas=[];
  globalThis.fetch=async (url,opcoes={}) => { chamadas.push({url,opcoes}); return retorno(url,opcoes); };
  return chamadas;
}
function json(data,status=200) { return { ok: status>=200 && status<300, status, json: async()=>data }; }

test('login e /me enviam Bearer do JWT da aplicação', async () => {
  logoutApi();
  const chamadas=instalarFetch((url)=>url.includes('/login') ? json({ access_token:'jwt-local',usuario }) : json({ ...usuario, google_vinculado: true }));
  assert.equal((await loginApi('  teste@exemplo.com  ','Senha123')).id,'org-1');
  assert.equal((await validarSessaoApi()).google_vinculado,true);
  assert.equal(JSON.parse(chamadas[0].opcoes.body).email,'teste@exemplo.com');
  assert.equal(chamadas[1].opcoes.headers.Authorization,'Bearer jwt-local');
});
test('401 autenticado apaga sessão e não mantém usuário no frontend', async () => {
  instalarFetch(() => json({ detail:'Sessão expirada' },401));
  await assert.rejects(() => validarSessaoApi(), err => err.status === 401);
  assert.equal(usuarioSessaoApi(),null);
});
test('cadastro real retorna e guarda sessão sem confirmação da senha', async () => {
  const chamadas=instalarFetch(() => json({ access_token:'jwt-2',usuario },201));
  const form={ tipo:'DOADOR', perfil:'PESSOA_FISICA',nome:'Joana',cpf:'529.982.247-25',email_contato:'joana@teste.com',telefone:'82999999999',logradouro:'Rua X',numero:'10',complemento:'',bairro:'Centro',cidade:'Arapiraca',uf:'AL',cep:'57300000',responsavel:'Joana',email:'joana@teste.com',senha:'Senha@123',confirmacao:'Senha@123' };
  assert.equal((await cadastrarApi(form)).status, 'PENDENTE');
  assert.ok(chamadas[0].url.endsWith('/api/auth/cadastro'));
  assert.ok(!('confirmacao' in JSON.parse(chamadas[0].opcoes.body)));
});
test('conclusão de perfil usa JWT existente e recebe objeto usuário diretamente', async () => {
  const chamadas=instalarFetch(() => json(usuario,201));
  const perfil={ tipo:'DOADOR',perfil:'PESSOA_FISICA',nome:'Joana',cpf:'529.982.247-25',email_contato:'joana@teste.com',telefone:'82999999999',logradouro:'Rua X',numero:'10',complemento:'',bairro:'Centro',cidade:'Arapiraca',uf:'AL',cep:'57300000' };
  await completarPerfilApi(perfil);
  assert.ok(chamadas[0].url.endsWith('/api/auth/perfil'));
  assert.equal(chamadas[0].opcoes.headers.Authorization,'Bearer jwt-2');
});
test('login Google envia desafio e ID token, mas usa somente JWT local nas chamadas',async()=>{
  const chamadas=instalarFetch(() => json({ access_token:'jwt-google',usuario }));
  await loginGoogleApi('uuid', 'google-token');
  const payload=JSON.parse(chamadas[0].opcoes.body);
  assert.deepEqual(payload,{desafio_id:'uuid',id_token:'google-token'});
  assert.equal(usuarioSessaoApi().usuario_id,'user-1');
  assert.ok(!JSON.stringify(usuarioSessaoApi()).includes('google-token'));
});
test('vinculação exige senha e JWT local, não faz merge automático',async()=>{
  const chamadas=instalarFetch(() => json({access_token:'jwt-google',usuario:{...usuario,google_vinculado:true}}));
  await vincularGoogleApi('uuid2','google-token','SenhaLocal');
  assert.ok(chamadas[0].url.endsWith('/api/auth/google/vincular'));
  assert.equal(chamadas[0].opcoes.headers.Authorization,'Bearer jwt-google');
  assert.equal(JSON.parse(chamadas[0].opcoes.body).senha_atual,'SenhaLocal');
});
test('requisição autenticada em falha de conexão não apaga sessão válida',async()=>{
  globalThis.fetch=async()=>{ throw new TypeError('network'); };
  await assert.rejects(() => requisicaoApi('/api/auth/me',{autenticada:true}),/Não foi possível conectar/);
  assert.ok(usuarioSessaoApi());
});

test('senha Google incorreta não derruba JWT de sessão local',async()=>{
  const antes=usuarioSessaoApi();
  instalarFetch(()=>json({detail:{codigo:'SENHA_INVALIDA',mensagem:'Senha atual inválida.'}},401));
  await assert.rejects(()=>vincularGoogleApi('uuid3','google-token','errada'),e=>e.status===401&&e.codigo==='SENHA_INVALIDA');
  assert.equal(usuarioSessaoApi().usuario_id,antes.usuario_id);
});
