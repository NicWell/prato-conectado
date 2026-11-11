import { useState } from 'react';
import logoPratoConectado from '../assets/logo-prato-conectado.png';
import { emailValido, formatarCpf, formatarTelefone, formatarCnpj } from '../utils/formularios.js';
import { FORM_INICIAL, ESTADOS, validarFormularioCadastro } from '../utils/cadastro.js';
import { dadosDemo } from '../mock/store.js';
import GoogleIdentityButton from './GoogleIdentityButton.jsx';

export function Logo({ large = false }) {
  return <span className={`logo ${large ? 'logo--large' : ''}`}>
    <img className="logo__image" src={logoPratoConectado} alt="" aria-hidden="true" />
    <span className="logo__words">Prato <strong>Conectado</strong></span>
  </span>;
}
export function Hero({ tipo = 'LOGIN' }) {
  return <section className="auth-hero">
    <div className="hero-decoration hero-decoration--top" />
    <div className="hero-content">
      <div className="hero-brand"><Logo large /><span className="hero-chip">FAÇA PARTE DA REDE</span></div>
      <h1>Alimentos<br />podem chegar<br />mais longe.</h1>
      <p className="hero-description">Conecte alimentos disponíveis a organizações que ajudam quem mais precisa, sem desperdício.</p>
      <div className="hero-note"><span>✓</span><p>{tipo === 'LOGIN' ? 'Acesse sua conta ou crie um cadastro para participar da rede.' : 'Novos cadastros aguardam aprovação administrativa.'}</p></div>
    </div>
    <div className="hero-decoration hero-decoration--bottom" />
  </section>;
}
export function AuthShell({ children, theme, toggleTheme, tipo }) {
  return <div className={`auth-layout theme-${theme}`}>
    <Hero tipo={tipo} />
    <main className="auth-right" id="auth-form-scroll"><div className="auth-content">{children}</div></main>
    <button type="button" className="theme-switch theme-switch--auth" onClick={toggleTheme}>Modo {theme === 'dark' ? 'claro' : 'escuro'}</button>
  </div>;
}
function Field({ id, label, error, hint, ...props }) {
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <input id={id} name={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...props} />
    {hint && !error && <small id={`${id}-hint`} className="field-hint">{hint}</small>}
    {error && <small id={`${id}-error`} className="field-error" role="alert">{error}</small>}
  </div>;
}
export function LoginScreen({ apiAtiva = false, theme, toggleTheme, onLogin, onGoogleLogin, onDemo, navigate, onReset }) {
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(''); const [enviando, setEnviando] = useState(false);
  async function entrar(e) {
    e.preventDefault(); setErro(''); setEnviando(true);
    try { await onLogin(email, senha); } catch (err) { setErro(err.message); } finally { setEnviando(false); }
  }
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="LOGIN">
    <p className="eyebrow">ACESSO À PLATAFORMA</p><h2 className="auth-title">Entrar</h2>
    <form onSubmit={entrar} className="auth-form" noValidate>
      <Field id="email" label="E-mail" type="email" value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} placeholder="seuemail@exemplo.com" required />
      <Field id="senha" label="Senha" type="password" value={senha} autoComplete="current-password" onChange={e => setSenha(e.target.value)} placeholder="••••••••" required />
      <div className="align-end"><button type="button" className="link-button" onClick={onReset}>Esqueci minha senha</button></div>
      {erro && <p className="alert alert--error" role="alert">{erro}</p>}
      <button disabled={enviando} type="submit" className="btn btn--red btn--wide">{enviando ? 'Entrando...' : 'Entrar'}</button>
    </form>
    <div className="divider-label"><span>ou</span></div>
    {apiAtiva ? <GoogleIdentityButton onCredential={onGoogleLogin} disabled={enviando} /> : <button type="button" className="btn btn--outline btn--wide" onClick={() => onDemo('DOADOR')}>Entrar como doador (mock)</button>}
    {apiAtiva && <p className="helper-center">Primeiro acesso Google? Após entrar, você poderá completar seus dados. Se seu e-mail já possui uma conta local, entre com senha para vincular o Google.</p>}
    <div className="auth-bottom"><p>Ainda não tem acesso?</p>
      <button type="button" className="btn btn--yellow btn--wide" onClick={() => navigate('/cadastro')}>Criar usuário</button>
      {!apiAtiva && <button type="button" className="underlined" onClick={() => navigate('/demonstracao')}>Contas de demonstração</button>}
    </div>
  </AuthShell>;
}
function CadastroForm({ theme, toggleTheme, onSubmit, navigate, perfilGoogle = false, usuario }) {
  const [form, setForm] = useState(() => ({ ...FORM_INICIAL, ...(perfilGoogle ? { nome: usuario?.nome || '', email_contato: usuario?.email || '' } : {}) }));
  const [erros, setErros] = useState({}); const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const isOng = form.tipo === 'ONG'; const isEmpresa = !isOng && form.perfil === 'EMPRESA';
  const pessoa = !isOng && !isEmpresa;
  function alterar(id, value) {
    const novo = id === 'cpf' ? formatarCpf(value) : id === 'cnpj' ? formatarCnpj(value) : id === 'telefone' ? formatarTelefone(value) : id === 'uf' ? value.toUpperCase() : id === 'cep' ? value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2') : value;
    setForm(old => ({ ...old, [id]: novo })); setErros(old => ({ ...old, [id]: '' })); setErroGeral('');
  }
  function campo(id, label, extra = {}) { return <Field id={id} label={label} value={form[id]} onChange={e => alterar(id, e.target.value)} error={erros[id]} {...extra} />; }
  async function enviar(e) {
    e.preventDefault(); if (enviando) return;
    const issues = validarFormularioCadastro(form, perfilGoogle); setErros(issues);
    if (Object.keys(issues).length) { setErroGeral('Revise os campos destacados.'); return; }
    setEnviando(true); setErroGeral('');
    try { await onSubmit(form); }
    catch (err) { setErroGeral(err.message); setErros(old => ({ ...old, ...err.fields })); }
    finally { setEnviando(false); }
  }
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="REGISTER">
    <p className="eyebrow">{perfilGoogle ? 'CONCLUIR PRIMEIRO ACESSO' : 'NOVO ACESSO'}</p>
    <h2 className="auth-title">{perfilGoogle ? 'Complete seu cadastro' : 'Criar usuário'}</h2>
    <p className="auth-subtitle">{perfilGoogle ? <>Olá, {usuario?.responsavel || usuario?.nome}. Sua conta Google já está autenticada. Preencha o perfil para solicitar aprovação.</> : 'Escolha o tipo de conta e informe seus dados.'}</p>
    <form className="auth-form auth-form--register" onSubmit={enviar} noValidate>
      <div className="segmented" role="group" aria-label="Tipo de usuário">
        <button type="button" className={`pill ${!isOng ? 'pill--active' : ''}`} onClick={() => alterar('tipo', 'DOADOR')} aria-pressed={!isOng}>Doador</button>
        <button type="button" className={`pill ${isOng ? 'pill--active' : ''}`} onClick={() => alterar('tipo', 'ONG')} aria-pressed={isOng}>ONG</button>
      </div>
      {!isOng && <div className="field"><label htmlFor="perfil">Você doa como</label>
        <select id="perfil" value={form.perfil} onChange={e => alterar('perfil', e.target.value)}><option value="EMPRESA">Empresa</option><option value="PESSOA_FISICA">Pessoa física</option></select>
      </div>}
      <p className="form-section-title">{pessoa ? 'Dados do doador' : 'Dados da organização'}</p>
      {campo('nome', pessoa ? 'Nome do doador' : isOng ? 'Nome da ONG' : 'Nome da empresa', { maxLength: 180, autoComplete: pessoa ? 'name' : 'organization' })}
      {pessoa ? campo('cpf', 'CPF do doador', { placeholder: '000.000.000-00', maxLength: 14 }) : campo('cnpj', 'CNPJ', { placeholder: '00.ABC.000/0000-00', maxLength: 18 })}
      {isOng && campo('capacidade', 'Capacidade de atendimento (pessoas)', { type: 'number', min: 1, max: 2147483647, step: 1 })}
      {campo('email_contato', 'E-mail de contato', { type: 'email', autoComplete: 'email', maxLength: 255, placeholder: 'contato@exemplo.com' })}
      {campo('telefone', 'Telefone com DDD', { type: 'tel', autoComplete: 'tel', placeholder: '(82) 99999-9999' })}
      <p className="form-section-title">Endereço</p>
      {campo('logradouro', 'Logradouro', { placeholder: 'Rua, avenida...', maxLength: 180, autoComplete: 'address-line1' })}
      <div className="auth-form-row">{campo('numero', 'Número', { placeholder: '100 ou s/n', maxLength: 15 })}{campo('complemento', 'Complemento (opcional)', { placeholder: 'Sala, bloco...', maxLength: 120 })}</div>
      {campo('bairro', 'Bairro', { maxLength: 100 })}
      <div className="auth-form-row">{campo('cidade', 'Cidade', { maxLength: 120 })}
        <div className="field"><label htmlFor="uf">UF</label><select id="uf" value={form.uf} aria-invalid={Boolean(erros.uf)} onChange={e => alterar('uf', e.target.value)}><option value="">Selecione</option>{ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select>{erros.uf && <small className="field-error" role="alert">{erros.uf}</small>}</div></div>
      {campo('cep', 'CEP', { placeholder: '00000-000', maxLength: 9, inputMode: 'numeric', autoComplete: 'postal-code' })}
      {!perfilGoogle && <>
        <p className="form-section-title">Responsável pelo acesso</p>
        {campo('responsavel', 'Nome completo do responsável', { autoComplete: 'name', maxLength: 160 })}
        {campo('email', 'E-mail de acesso', { type: 'email', autoComplete: 'email', maxLength: 255 })}
        {campo('senha', 'Senha (mínimo 8 caracteres)', { type: 'password', autoComplete: 'new-password' })}
        {campo('confirmacao', 'Confirmar senha', { type: 'password', autoComplete: 'new-password' })}
      </>}
      {erroGeral && <p className="alert alert--error" role="alert">{erroGeral}</p>}
      <button className="btn btn--red btn--wide" type="submit" disabled={enviando}>{enviando ? 'Enviando...' : perfilGoogle ? 'Enviar para aprovação' : 'Criar usuário'}</button>
      {perfilGoogle ? <button type="button" className="btn btn--outline btn--wide" onClick={() => navigate('/sair')}>Sair e concluir depois</button> : <button className="btn btn--outline btn--wide" type="button" onClick={() => navigate('/entrar')}>Voltar ao login</button>}
    </form>
  </AuthShell>;
}
export function RegisterScreen(props) { return <CadastroForm {...props} />; }
export function CompleteProfileScreen(props) { return <CadastroForm {...props} perfilGoogle />; }
export function PendingScreen({ usuario, theme, toggleTheme, onLogout, onRefresh, onLink, apiAtiva = false }) {
  const [erro, setErro] = useState(''); const [carregando, setCarregando] = useState(false);
  async function atualizar() { setCarregando(true); setErro(''); try { await onRefresh(); } catch (e) { setErro(e.message); } finally { setCarregando(false); } }
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="REGISTER">
    <div className="pending-page"><div className="pending-icon">✓</div><p className="eyebrow">SOLICITAÇÃO RECEBIDA</p><h2 className="auth-title">Cadastro enviado!</h2>
      <p>O cadastro de <strong>{usuario.nome}</strong> aguarda análise de um administrador.</p>
      <div className="pending-status"><span>Status do cadastro</span><strong>Pendente de aprovação</strong></div>
      <p className="field-hint">Até a aprovação, não é possível publicar ou reservar doações.</p>
      {erro && <p className="alert alert--error" role="alert">{erro}</p>}
      {apiAtiva && <button type="button" onClick={atualizar} disabled={carregando} className="btn btn--yellow btn--wide">{carregando ? 'Consultando...' : 'Consultar situação'}</button>}
      {apiAtiva && !usuario.google_vinculado && <button type="button" onClick={onLink} className="btn btn--outline btn--wide">Vincular minha conta Google</button>}
      <button type="button" onClick={onLogout} className="btn btn--red btn--wide">Sair</button>
    </div>
  </AuthShell>;
}
export function RejectedScreen({ usuario, theme, toggleTheme, onLogout, onRefresh }) {
  const [erro, setErro] = useState(''); const [loading, setLoading] = useState(false);
  async function atualizar() { setLoading(true); setErro(''); try { await onRefresh(); } catch (e) { setErro(e.message); } finally { setLoading(false); } }
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="REGISTER">
    <p className="eyebrow">ANÁLISE DO CADASTRO</p><h2 className="auth-title">Cadastro não aprovado</h2>
    <p className="auth-subtitle">O cadastro de <strong>{usuario.nome}</strong> foi reprovado. Procure a equipe responsável para mais informações.</p>
    {usuario.motivo_reprovacao && <p className="alert alert--error"><strong>Justificativa:</strong> {usuario.motivo_reprovacao}</p>}
    <div className="pending-status"><span>Status do cadastro</span><strong>Reprovado</strong></div>
    {erro && <p className="alert alert--error" role="alert">{erro}</p>}
    <button type="button" className="btn btn--yellow btn--wide" onClick={atualizar} disabled={loading}>{loading ? 'Consultando...' : 'Consultar situação'}</button>
    <button type="button" className="btn btn--outline btn--wide" onClick={onLogout}>Sair</button>
  </AuthShell>;
}
export function GoogleLinkScreen({ usuario, theme, toggleTheme, navigate, onVincular }) {
  const [senha, setSenha] = useState(''); const [erro, setErro] = useState('');
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="LOGIN">
    <p className="eyebrow">SEGURANÇA DA CONTA</p><h2 className="auth-title">Vincular conta Google</h2>
    <p className="auth-subtitle">Sua conta <strong>{usuario.email}</strong> continuará aceitando senha. Selecione exatamente esse e-mail no Google e confirme sua senha local.</p>
    {usuario.google_vinculado ? <p className="alert alert--success">Sua conta Google já está vinculada.</p> : <>
      <div className="auth-form"><Field id="senha_atual" label="Senha atual" type="password" autoComplete="current-password" value={senha} onChange={e => { setSenha(e.target.value); setErro(''); }} />
        {!senha && <p className="field-hint">Preencha sua senha antes de escolher o Google.</p>}
        {erro && <p className="alert alert--error" role="alert">{erro}</p>}
        {senha && <GoogleIdentityButton vincular onCredential={async (desafio, token) => { try { await onVincular(desafio, token, senha); } catch (e) { setErro(e.message); throw e; } }} />}
      </div>
    </>}
    <button className="btn btn--outline btn--wide" type="button" onClick={() => navigate('/app/inicio')}>Voltar</button>
  </AuthShell>;
}
export function ResetScreen({ apiAtiva = false, theme, toggleTheme, onReset, navigate }) {
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [confirmar, setConfirmar] = useState('');
  const [msg, setMsg] = useState(''); const [erro, setErro] = useState(''); const [loading, setLoading] = useState(false);
  async function enviar(e) {
    e.preventDefault(); if (apiAtiva) return;
    setErro(''); setMsg('');
    if (!emailValido(email)) return setErro('Informe um e-mail válido.');
    if (senha.length < 8) return setErro('A senha deve ter pelo menos 8 caracteres.');
    if (senha !== confirmar) return setErro('As senhas não coincidem.');
    setLoading(true); try { await onReset(email, senha); setMsg('Senha alterada apenas na simulação local.'); } catch (e) { setErro(e.message); } finally { setLoading(false); }
  }
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="LOGIN">
    <p className="eyebrow">ACESSO À PLATAFORMA</p><h2 className="auth-title">Recuperar senha</h2>
    {apiAtiva ? <p className="alert alert--error" role="status">A recuperação de senha pela API ainda não foi implementada. Nenhuma senha real será alterada nesta tela. Entre em contato com a equipe responsável.</p> : <form className="auth-form" onSubmit={enviar} noValidate>
      <p className="auth-subtitle">Modo de demonstração: alteração apenas neste navegador.</p>
      <Field id="email" label="E-mail cadastrado" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <Field id="senha" label="Nova senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} />
      <Field id="confirmar" label="Confirmar senha" type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} />
      {erro && <p className="alert alert--error" role="alert">{erro}</p>}{msg && <p className="alert alert--success" role="status">{msg}</p>}
      <button disabled={loading} className="btn btn--red btn--wide" type="submit">{loading ? 'Alterando...' : 'Alterar senha (mock)'}</button>
    </form>}
    <button className="btn btn--outline btn--wide" type="button" onClick={() => navigate('/entrar')}>Voltar ao login</button>
  </AuthShell>;
}
export function DemoScreen({ apiAtiva = false, theme, toggleTheme, onDemo, onRestore, navigate }) {
  const [msg, setMsg] = useState('');
  async function restaurar() { if (!window.confirm('Apagar dados demonstrativos deste navegador?')) return; await onRestore(); setMsg('Dados mock restaurados.'); }
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="LOGIN">
    <p className="eyebrow">AMBIENTE DE TESTES</p><h2 className="auth-title">Contas de demonstração</h2>
    {apiAtiva ? <p className="alert alert--error">No modo API, as contas de demonstração só funcionam se foram habilitadas e criadas pelo backend. Nenhum usuário mock autentica na API.</p> : <>
      <div className="demo-account"><strong>Doador</strong><code>{dadosDemo.doador}</code><button className="btn btn--red" onClick={() => onDemo('DOADOR')}>Entrar como doador</button></div>
      <div className="demo-account"><strong>ONG</strong><code>{dadosDemo.ong}</code><button className="btn btn--red" onClick={() => onDemo('ONG')}>Entrar como ONG</button></div>
      <p className="field-hint">Senha inicial: {dadosDemo.senha}</p>
      <button type="button" className="btn btn--outline btn--wide" onClick={restaurar}>Restaurar dados de exemplo</button>
      {msg && <p className="alert alert--success" role="status">{msg}</p>}
    </>}
    <button className="underlined" type="button" onClick={() => navigate('/entrar')}>Voltar ao login</button>
  </AuthShell>;
}
