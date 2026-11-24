import { useCallback, useEffect, useState } from 'react';
import { CompleteProfileScreen, GoogleLinkScreen, LoginScreen, PendingScreen, RegisterScreen, RejectedScreen, ResetScreen } from './components/AuthScreens.jsx';
import WorkspaceApi from './components/WorkspaceApi.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import { destino, perfilIncompleto } from './utils/sessao.js';
import { cadastrarApi, completarPerfilApi, loginApi, loginGoogleApi, logoutApi, usuarioSessaoApi, validarSessaoApi, vincularGoogleApi } from './services/auth.js';

function lerRota() { return window.location.hash.slice(1) || '/entrar'; }
export default function App() {
  const [rota, setRota] = useState(lerRota);
  const [tema, setTema] = useState(() => localStorage.getItem('prato_tema') || 'dark');
  const [usuario, setUsuario] = useState(null);
  const [pronto, setPronto] = useState(false);
  const [fatal, setFatal] = useState('');
  const [aviso, setAviso] = useState('');
  const navegar = useCallback((caminho) => {
    if (window.location.hash === `#${caminho}`) setRota(caminho);
    else window.location.hash = caminho;
  }, []);
  const atualizarDados = useCallback(() => setUsuario(usuarioSessaoApi()), []);
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
        await validarSessaoApi();
        if (ativo) { setUsuario(usuarioSessaoApi()); setPronto(true); }
      } catch (e) { if (ativo) { setFatal(e.message); setPronto(true); } }
    })();
    return () => { ativo = false; window.removeEventListener('hashchange', onHash); window.removeEventListener('prato:sessao-alterada', atualizarDados); window.removeEventListener('prato:sessao-expirada', onSessaoExpirada); };
  }, [atualizarDados, navegar]);
  useEffect(() => { localStorage.setItem('prato_tema', tema); }, [tema]);
  useEffect(() => {
    if (usuario?.papel_sistema === 'ADMINISTRADOR' && rota !== '/admin/cadastros') window.location.hash = '/admin/cadastros';
  }, [usuario, rota]);
  const alternarTema = () => setTema(t => t === 'dark' ? 'light' : 'dark');
  const entrar = async (email, senha) => {
    const u = await loginApi(email, senha);
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
  const cadastrar = async (dados) => {
    const u = await cadastrarApi(dados);
    atualizarDados(); navegar(destino(u));
  };
  const completarPerfil = async (dados) => {
    const u = await completarPerfilApi(dados);
    atualizarDados(); navegar(destino(u));
  };
  const consultarSituacao = async () => {
    await validarSessaoApi(); atualizarDados();
    const u = usuarioSessaoApi(); if (u) navegar(destino(u));
  };
  const sair = () => {
    logoutApi();
    atualizarDados(); navegar('/entrar');
  };
  if (!pronto) return <div className="loading-screen" role="status">Carregando Prato Conectado...</div>;
  if (fatal) return <div className="loading-screen"><h1>Não foi possível consultar a sessão</h1><p>{fatal}</p><button className="btn btn--red" onClick={() => window.location.reload()}>Tentar novamente</button></div>;
  let tela;
  if (usuario?.papel_sistema === 'ADMINISTRADOR') {
    tela = <AdminPanel usuario={usuario} tema={tema} alternarTema={alternarTema} sair={sair} />;
  } else if (rota === '/sair') { // O botão de conclusão posterior usa navegação declarativa.
    tela = <AuthShellLogout onLogout={sair} />;
  } else if (usuario && rota === '/vincular-google') {
    tela = <GoogleLinkScreen usuario={usuario} theme={tema} toggleTheme={alternarTema} navigate={navegar} onVincular={vincular} />;
  } else if (usuario && perfilIncompleto(usuario)) {
    tela = <CompleteProfileScreen key={usuario.usuario_id || usuario.id} usuario={usuario} theme={tema} toggleTheme={alternarTema} onSubmit={completarPerfil} navigate={navegar} />;
  } else if (usuario?.status === 'REPROVADA' || usuario?.status === 'REPROVADO') {
    tela = <RejectedScreen usuario={usuario} theme={tema} toggleTheme={alternarTema} onLogout={sair} onRefresh={consultarSituacao} />;
  } else if (usuario?.status === 'PENDENTE') {
    tela = <PendingScreen usuario={usuario} theme={tema} toggleTheme={alternarTema} onLogout={sair} onRefresh={consultarSituacao} onLink={() => navegar('/vincular-google')} />;
  } else if (usuario?.status === 'APROVADA') {
    const rotaApp = rota.startsWith('/app/') ? rota : '/app/inicio';
    tela = <WorkspaceApi key={`${usuario.id}:${rotaApp}`} usuario={usuario} tema={tema} alternarTema={alternarTema} rota={rotaApp} navegar={navegar} sair={sair} vincularGoogle={!usuario.google_vinculado ? () => navegar('/vincular-google') : null} />;
  } else if (rota === '/cadastro') {
    tela = <RegisterScreen theme={tema} toggleTheme={alternarTema} onSubmit={cadastrar} navigate={navegar} />;
  } else if (rota === '/recuperar-senha') {
    tela = <ResetScreen theme={tema} toggleTheme={alternarTema} navigate={navegar} />;
  } else {
    tela = <LoginScreen theme={tema} toggleTheme={alternarTema} onLogin={entrar} onGoogleLogin={entrarGoogle} navigate={navegar} onReset={() => navegar('/recuperar-senha')} />;
  }
  return <>
    {tela}
    {aviso && <div className="toast" role="status"><span>{aviso}</span><button type="button" onClick={() => setAviso('')} aria-label="Fechar aviso">×</button></div>}
  </>;
}
function AuthShellLogout({ onLogout }) {
  return <div className="loading-screen"><p>Seu cadastro pode ser concluído mais tarde.</p><button type="button" className="btn btn--red" onClick={onLogout}>Sair da conta</button></div>;
}
