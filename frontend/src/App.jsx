import { useCallback, useEffect, useState } from 'react';
import { acessarDemo, autenticar, encerrarSessao, iniciarMock, listarDoacoes, mudarStatusDoacao, novaDoacao, redefinirSenha, registrar, restaurarMock, usuarioAtual } from './mock/store.js';
import { DemoScreen, LoginScreen, PendingScreen, RegisterScreen, ResetScreen } from './components/AuthScreens.jsx';
import Workspace from './components/Workspace.jsx';

function lerRota() { return window.location.hash.slice(1) || '/entrar'; }
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
    setUsuario(usuarioAtual()); setDoacoes(listarDoacoes());
  }, []);
  useEffect(() => {
    const onHash = () => { setRota(lerRota()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    iniciarMock().then(() => { atualizarDados(); setPronto(true); }).catch(e => { setFatal(e.message); setPronto(true); });
    return () => window.removeEventListener('hashchange', onHash);
  }, [atualizarDados]);
  useEffect(() => { localStorage.setItem('prato_tema', tema); }, [tema]);
  const alternarTema = () => setTema(t => t === 'dark' ? 'light' : 'dark');
  const avisar = (msg) => { setAviso(msg); };
  const entrar = async (email, senha) => {
    const u = await autenticar(email, senha); atualizarDados();
    navegar(u.status === 'PENDENTE' ? '/pendente' : '/app/inicio');
  };
  const entrarDemo = async (tipo) => {
    await acessarDemo(tipo); atualizarDados(); navegar('/app/inicio');
    avisar('Acesso de demonstração: autenticação local, sem servidor.');
  };
  const cadastrar = async (dados) => { await registrar(dados); atualizarDados(); navegar('/pendente'); };
  const sair = () => { encerrarSessao(); atualizarDados(); navegar('/entrar'); };
  const publicar = (dados) => {
    novaDoacao(usuario, dados); atualizarDados(); avisar('Doação publicada na simulação!');
  };
  const atualizar = (id, acao) => {
    try {
      mudarStatusDoacao(id, usuario, acao); atualizarDados();
      avisar(({ CANCELAR: 'Doação cancelada.', RESERVAR: 'Doação reservada pela ONG.', RETIRAR: 'Retirada confirmada.', ENTREGAR: 'Entrega concluída.' })[acao]);
    } catch(e) { avisar(e.message); }
  };
  const restaurar = async () => { await restaurarMock(); atualizarDados(); };
  if (!pronto) return <div className="loading-screen">Carregando Prato Conectado...</div>;
  if (fatal) return <div className="loading-screen"><h1>Não foi possível abrir o protótipo</h1><p>{fatal}</p><p>Execute em localhost ou em HTTPS e habilite o armazenamento local do navegador.</p></div>;
  const appRota = rota.startsWith('/app/');
  let tela;
  if (usuario?.status === 'PENDENTE') {
    tela = <PendingScreen usuario={usuario} theme={tema} toggleTheme={alternarTema} onLogout={sair} />;
  } else if (appRota && usuario?.status === 'APROVADA') {
    tela = <Workspace usuario={usuario} tema={tema} alternarTema={alternarTema} rota={rota} navegar={navegar} sair={sair} doacoes={doacoes} publicar={publicar} atualizar={atualizar} />;
  } else if (usuario?.status === 'APROVADA') {
    tela = <Workspace usuario={usuario} tema={tema} alternarTema={alternarTema} rota="/app/inicio" navegar={navegar} sair={sair} doacoes={doacoes} publicar={publicar} atualizar={atualizar} />;
  } else if (rota === '/cadastro') {
    tela = <RegisterScreen theme={tema} toggleTheme={alternarTema} onRegister={cadastrar} navigate={navegar} />;
  } else if (rota === '/recuperar-senha') {
    tela = <ResetScreen theme={tema} toggleTheme={alternarTema} onReset={redefinirSenha} navigate={navegar} />;
  } else if (rota === '/demonstracao') {
    tela = <DemoScreen theme={tema} toggleTheme={alternarTema} onDemo={entrarDemo} onRestore={restaurar} navigate={navegar} />;
  } else {
    tela = <LoginScreen theme={tema} toggleTheme={alternarTema} onLogin={entrar} onDemo={entrarDemo} navigate={navegar} onReset={() => navegar('/recuperar-senha')} />;
  }
  return <>{tela}{aviso && <div className="toast" role="status"><span>{aviso}</span><button type="button" onClick={() => setAviso('')} aria-label="Fechar aviso">×</button></div>}</>;
}
