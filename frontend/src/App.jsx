import { useCallback, useEffect, useState } from 'react';
import { acessarDemo, autenticar, encerrarSessao, iniciarMock, listarDoacoes, mudarStatusDoacao, novaDoacao, redefinirSenha, registrar, restaurarMock, usuarioAtual } from './mock/store.js';
import { CompleteProfileScreen, DemoScreen, GoogleLinkScreen, LoginScreen, PendingScreen, RegisterScreen, RejectedScreen, ResetScreen } from './components/AuthScreens.jsx';
import Workspace from './components/Workspace.jsx';
import { USAR_API_AUTH, cadastrarApi, completarPerfilApi, loginApi, loginGoogleApi, logoutApi, usuarioSessaoApi, validarSessaoApi, vincularGoogleApi } from './services/auth.js';

function lerRota() { return window.location.hash.slice(1) || '/entrar'; }
function perfilIncompleto(usuario) { return usuario?.cadastro_completo === false || usuario?.tipo === 'SEM_ORGANIZACAO'; }
function destino(usuario) {
  if (perfilIncompleto(usuario)) return '/concluir-cadastro';
  if (usuario?.status === 'PENDENTE') return '/pendente';
  if (usuario?.status === 'REPROVADA' || usuario?.status === 'REPROVADO') return '/reprovado';
  return '/app/inicio';
}
export default function App() {
  const [rota, setRota] = useState(lerRota);
  const [tema, setTema] = useState(() => localStorage.getItem('prato_tema') || 'dark');
  const [usuario, setUsuario] = useState(null);
  const [doacoes, setDoacoes] = useState([]);
  const [pronto, setPronto] = useState(false);
  const [fatal, setFatal] = useState('');
  const [aviso, setAviso] = useState('');
  const navegar = useCallback((caminho) => {
    if (window.location.hash === `#${caminho}`) setRota(caminho);
    else window.location.hash = caminho;
  }, []);
  const atualizarDados = useCallback(() => {
    setUsuario(USAR_API_AUTH ? usuarioSessaoApi() : usuarioAtual());
    try { setDoacoes(listarDoacoes()); } catch { setDoacoes([]); }
  }, []);
  useEffect(() => {
    let ativo = true;
    const onHash = () => setRota(lerRota());
    const onSessaoExpirada = () => {
      if (!ativo) return;
      setUsuario(null);
      setAviso('Sua sessão expirou. Entre novamente para continuar.');
      navegar('/entrar');
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('prato:sessao-alterada', atualizarDados);
    window.addEventListener('prato:sessao-expirada', onSessaoExpirada);
    (async () => {
      try {
        // A inicialização do mock nunca pode impedir o login real.
        if (USAR_API_AUTH) {
          await validarSessaoApi();
          if (ativo) { setUsuario(usuarioSessaoApi()); setPronto(true); }
          iniciarMock().then(() => { if (ativo) atualizarDados(); }).catch(() => {});
        } else {
          await iniciarMock();
          if (ativo) { atualizarDados(); setPronto(true); }
        }
      } catch (e) { if (ativo) { setFatal(e.message); setPronto(true); } }
    })();
    return () => { ativo = false; window.removeEventListener('hashchange', onHash); window.removeEventListener('prato:sessao-alterada', atualizarDados); window.removeEventListener('prato:sessao-expirada', onSessaoExpirada); };
  }, [atualizarDados, navegar]);
  useEffect(() => { localStorage.setItem('prato_tema', tema); }, [tema]);
  const alternarTema = () => setTema(t => t === 'dark' ? 'light' : 'dark');
  const entrar = async (email, senha) => {
    const u = USAR_API_AUTH ? await loginApi(email, senha) : await autenticar(email, senha);
    atualizarDados(); navegar(destino(u));
  };
  const entrarGoogle = async (desafio, token) => {
    const u = await loginGoogleApi(desafio, token);
    atualizarDados(); navegar(destino(u));
  };
  const vincular = async (desafio, token, senha) => {
    const u = await vincularGoogleApi(desafio, token, senha);
    atualizarDados(); navegar(destino(u)); setAviso('Conta Google vinculada com sucesso.');
  };
  const entrarDemo = async (tipo) => {
    if (USAR_API_AUTH) throw new Error('Atalhos mock indisponíveis no modo API. Entre com credenciais cadastradas no servidor.');
    const u = await acessarDemo(tipo); atualizarDados(); navegar(destino(u));
    setAviso('Acesso de demonstração local.');
  };
  const cadastrar = async (dados) => {
    const u = USAR_API_AUTH ? await cadastrarApi(dados) : await registrar({ ...dados, endereco: `${dados.logradouro}, ${dados.numero}, ${dados.bairro}, ${dados.cidade} - ${dados.uf}, ${dados.cep}` });
    atualizarDados(); navegar(destino(u));
  };
  const completarPerfil = async (dados) => {
    const u = await completarPerfilApi(dados);
    atualizarDados(); navegar(destino(u));
  };
  const consultarSituacao = async () => {
    if (!USAR_API_AUTH) return;
    await validarSessaoApi(); atualizarDados();
    const u = usuarioSessaoApi(); if (u) navegar(destino(u));
  };
  const sair = () => {
    if (USAR_API_AUTH) logoutApi(); else encerrarSessao();
    atualizarDados(); navegar('/entrar');
  };
  const publicar = (dados) => {
    novaDoacao(usuario, dados); atualizarDados(); setAviso('Doação criada apenas no modo de demonstração (não salva no backend).');
  };
  const atualizar = (id, acao) => {
    try {
      mudarStatusDoacao(id, usuario, acao); atualizarDados();
      setAviso('Operação simulada neste navegador. Nenhum dado foi enviado ao backend.');
    } catch (e) { setAviso(e.message); }
  };
  const restaurar = async () => { if (!USAR_API_AUTH) { await restaurarMock(); atualizarDados(); } };
  if (!pronto) return <div className="loading-screen" role="status">Carregando Prato Conectado...</div>;
  if (fatal) return <div className="loading-screen"><h1>Não foi possível consultar a sessão</h1><p>{fatal}</p><button className="btn btn--red" onClick={() => window.location.reload()}>Tentar novamente</button></div>;
  let tela;
  if (rota === '/sair') { // O botão de conclusão posterior usa navegação declarativa.
    tela = <AuthShellLogout onLogout={sair} />;
  } else if (usuario && rota === '/vincular-google' && USAR_API_AUTH) {
    tela = <GoogleLinkScreen usuario={usuario} theme={tema} toggleTheme={alternarTema} navigate={navegar} onVincular={vincular} />;
  } else if (usuario && perfilIncompleto(usuario) && USAR_API_AUTH) {
    tela = <CompleteProfileScreen key={usuario.usuario_id || usuario.id} usuario={usuario} theme={tema} toggleTheme={alternarTema} onSubmit={completarPerfil} navigate={navegar} />;
  } else if (usuario?.status === 'REPROVADA' || usuario?.status === 'REPROVADO') {
    tela = <RejectedScreen usuario={usuario} theme={tema} toggleTheme={alternarTema} onLogout={sair} onRefresh={consultarSituacao} />;
  } else if (usuario?.status === 'PENDENTE') {
    tela = <PendingScreen usuario={usuario} apiAtiva={USAR_API_AUTH} theme={tema} toggleTheme={alternarTema} onLogout={sair} onRefresh={consultarSituacao} onLink={() => navegar('/vincular-google')} />;
  } else if (usuario?.status === 'APROVADA') {
    tela = <Workspace usuario={usuario} tema={tema} alternarTema={alternarTema} rota={rota.startsWith('/app/') ? rota : '/app/inicio'} navegar={navegar} sair={sair} doacoes={doacoes} publicar={publicar} atualizar={atualizar} vincularGoogle={USAR_API_AUTH && !usuario.google_vinculado ? () => navegar('/vincular-google') : null} />;
  } else if (rota === '/cadastro') {
    tela = <RegisterScreen theme={tema} toggleTheme={alternarTema} onSubmit={cadastrar} navigate={navegar} />;
  } else if (rota === '/recuperar-senha') {
    tela = <ResetScreen apiAtiva={USAR_API_AUTH} theme={tema} toggleTheme={alternarTema} onReset={redefinirSenha} navigate={navegar} />;
  } else if (rota === '/demonstracao') {
    tela = <DemoScreen apiAtiva={USAR_API_AUTH} theme={tema} toggleTheme={alternarTema} onDemo={entrarDemo} onRestore={restaurar} navigate={navegar} />;
  } else {
    tela = <LoginScreen apiAtiva={USAR_API_AUTH} theme={tema} toggleTheme={alternarTema} onLogin={entrar} onGoogleLogin={entrarGoogle} onDemo={entrarDemo} navigate={navegar} onReset={() => navegar('/recuperar-senha')} />;
  }
  return <>
    {USAR_API_AUTH && usuario?.status === 'APROVADA' && <div className="api-auth-notice" role="note">Autenticação conectada ao backend · Doações e reservas ainda são uma demonstração local.</div>}
    {tela}
    {aviso && <div className="toast" role="status"><span>{aviso}</span><button type="button" onClick={() => setAviso('')} aria-label="Fechar aviso">×</button></div>}
  </>;
}
function AuthShellLogout({ onLogout }) {
  return <div className="loading-screen"><p>Seu cadastro pode ser concluído mais tarde.</p><button type="button" className="btn btn--red" onClick={onLogout}>Sair da conta</button></div>;
}
