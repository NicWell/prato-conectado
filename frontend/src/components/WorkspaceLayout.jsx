import { Logo } from './AuthScreens.jsx';

export default function WorkspaceLayout({ tema, alternarTema, sair, perfil, rotuloSair, menu, acoes, children }) {
  return (
    <div className={`workspace theme-${tema}`}>
      <aside className="sidebar">
        <div className="sidebar__logo"><Logo /></div>
        <nav className="sidebar-nav" aria-label="Menu principal">{menu}</nav>
        <div className="sidebar-bottom">
          {acoes}
          <span className="sidebar-profile">{perfil}</span>
          <button type="button" onClick={sair} className="sidebar-logout">{rotuloSair}</button>
        </div>
      </aside>
      <main className="workspace-main">
        <button type="button" className="theme-switch workspace-theme-switch" onClick={alternarTema}>
          Modo {tema === 'dark' ? 'claro' : 'escuro'}
        </button>
        <div className="workspace-body">{children}</div>
      </main>
    </div>
  );
}
