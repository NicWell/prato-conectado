import { useState } from 'react';
import logoPratoConectado from '../assets/logo-prato-conectado.png';
import { emailValido, formatarCpf, formatarTelefone, formatarCnpj, validarRegistro } from '../utils/formularios.js';
import { dadosDemo } from '../mock/store.js';

const inicial = {
  tipo: 'DOADOR', perfil: 'EMPRESA', nome: '', cnpj: '', capacidade: '', endereco: '',
  telefone: '', responsavel: '', cpf: '', email: '', senha: '', confirmacao: '',
};

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
      <div className="hero-note"><span>✓</span><p>{tipo === 'LOGIN' ? 'Entre com e-mail e senha ou com o acesso demonstrativo. Se ainda não tem acesso, crie seu usuário.' : 'Perfis de administrador são criados pela equipe. Novos cadastros aguardam aprovação.'}</p></div>
    </div>
    <div className="hero-decoration hero-decoration--bottom" />
  </section>;
}

export function AuthShell({ children, theme, toggleTheme, tipo }) {
  return <div className={`auth-layout theme-${theme}`}>
    <Hero tipo={tipo} />
    <main className="auth-right" id="auth-form-scroll">
      <div className="auth-content">{children}</div>
    </main>
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

export function LoginScreen({ theme, toggleTheme, onLogin, onDemo, navigate, onReset }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function entrar(e) {
    e.preventDefault(); setErro(''); setEnviando(true);
    try { await onLogin(email, senha); }
    catch (err) { setErro(err.message); }
    finally { setEnviando(false); }
  }
  async function loginDemo(tipo) {
    setErro(''); setEnviando(true);
    try { await onDemo(tipo); }
    catch (err) { setErro(err.message); }
    finally { setEnviando(false); }
  }
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="LOGIN">
    <p className="eyebrow">ACESSO À PLATAFORMA</p>
    <h2 className="auth-title">Entrar</h2>
    <form onSubmit={entrar} noValidate className="auth-form">
      <Field id="email" label="E-mail" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" type="email" placeholder="seuemail@exemplo.com" />
      <Field id="senha" label="Senha" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="current-password" type="password" placeholder="••••••••" />
      <div className="align-end"><button type="button" className="link-button" onClick={onReset}>Esqueci minha senha</button></div>
      {erro && <p className="alert alert--error" role="alert">{erro}</p>}
      <button disabled={enviando} className="btn btn--red btn--wide" type="submit">{enviando ? 'Entrando...' : 'Entrar'}</button>
    </form>
    <div className="divider-label"><span>ou</span></div>
    <button className="btn btn--outline btn--wide" onClick={() => loginDemo('DOADOR')} disabled={enviando}>
      <span className="google-g" aria-hidden="true">G</span> Entrar com Google <span className="subtle-mini">(mock)</span>
    </button>
    <p className="helper-center">Este botão simula uma conta Google. OAuth real será integrado pelo backend.</p>
    <div className="auth-bottom"><p>Ainda não tem acesso?</p>
      <button className="btn btn--yellow btn--wide" onClick={() => navigate('/cadastro')}>Criar usuário</button>
      <button className="underlined" onClick={() => navigate('/demonstracao')}>Contas de demonstração e restauração</button>
    </div>
  </AuthShell>;
}

export function RegisterScreen({ theme, toggleTheme, onRegister, navigate }) {
  const [form, setForm] = useState(inicial);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const isOng = form.tipo === 'ONG';
  const isEmpresa = !isOng && form.perfil === 'EMPRESA';
  function alterar(id, value) {
    const novo = id === 'cpf' ? formatarCpf(value) : id === 'cnpj' ? formatarCnpj(value) : id === 'telefone' ? formatarTelefone(value) : value;
    setForm(old => ({ ...old, [id]: novo }));
    setErros(old => ({ ...old, [id]: '' }));
    setErroGeral('');
  }
  async function cadastrar(e) {
    e.preventDefault(); const found = validarRegistro(form);
    setErros(found); if (Object.keys(found).length) return;
    setEnviando(true); setErroGeral('');
    try { await onRegister(form); }
    catch (err) { setErroGeral(err.message); }
    finally { setEnviando(false); }
  }
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="REGISTER">
    <p className="eyebrow">NOVO ACESSO</p>
    <h2 className="auth-title">Criar usuário</h2>
    <p className="auth-subtitle">Escolha o tipo de conta.</p>
    <form className="auth-form auth-form--register" onSubmit={cadastrar} noValidate>
      <div className="segmented" role="group" aria-label="Tipo de usuário">
        <button type="button" className={`pill ${!isOng ? 'pill--active' : ''}`} onClick={() => alterar('tipo', 'DOADOR')} aria-pressed={!isOng}>Doador</button>
        <button type="button" className={`pill ${isOng ? 'pill--active' : ''}`} onClick={() => alterar('tipo', 'ONG')} aria-pressed={isOng}>ONG</button>
      </div>
      {!isOng && <div className="field"><label htmlFor="perfil">Você doa como</label>
        <select id="perfil" value={form.perfil} onChange={e => alterar('perfil', e.target.value)}><option value="EMPRESA">Empresa</option><option value="PESSOA_FISICA">Pessoa física</option></select>
        <small className="field-hint">Empresa: restaurante, padaria, mercado e outros. Pessoa física: sem CNPJ.</small>
      </div>}
      <p className="form-section-title">{!isOng && !isEmpresa ? 'Seus dados de contato' : 'Dados da organização'}</p>
      {(isOng || isEmpresa) && <Field id="nome" label={isOng ? 'Nome da ONG' : 'Nome da empresa'} value={form.nome} onChange={e => alterar('nome', e.target.value)} error={erros.nome} placeholder={isOng ? 'Ex.: ONG Mãos Solidárias' : 'Ex.: Padaria do Carlos'} autoComplete="organization" maxLength={140} />}
      {(isOng || isEmpresa) && <Field id="cnpj" label="CNPJ" value={form.cnpj} onChange={e => alterar('cnpj', e.target.value)} error={erros.cnpj} placeholder="00.000.000/0000-00" maxLength={18} />}
      {isOng && <Field id="capacidade" label="Capacidade de atendimento (pessoas por dia)" type="number" min="1" max="1000000" value={form.capacidade} onChange={e => alterar('capacidade', e.target.value)} error={erros.capacidade} placeholder="Ex.: 120" />}
      {!isOng && !isEmpresa && <Field id="nome" label="Nome do doador" value={form.nome} onChange={e => alterar('nome', e.target.value)} error={erros.nome} placeholder="Seu nome completo" autoComplete="name" />}
      <Field id="endereco" label="Endereço completo" value={form.endereco} onChange={e => alterar('endereco', e.target.value)} error={erros.endereco} placeholder="Rua, número, bairro, cidade e UF" autoComplete="street-address" />
      <Field id="telefone" label="Telefone de contato" value={form.telefone} onChange={e => alterar('telefone', e.target.value)} error={erros.telefone} placeholder="(82) 99999-9999" autoComplete="tel" maxLength={15} />
      <p className="form-section-title">Responsável pelo acesso</p>
      <Field id="responsavel" label="Nome completo" value={form.responsavel} onChange={e => alterar('responsavel', e.target.value)} error={erros.responsavel} autoComplete="name" placeholder="Nome do responsável pela conta" />
      <Field id="cpf" label="CPF" value={form.cpf} onChange={e => alterar('cpf', e.target.value)} error={erros.cpf} placeholder="000.000.000-00" maxLength={14} />
      <Field id="email" label="E-mail" type="email" value={form.email} onChange={e => alterar('email', e.target.value)} error={erros.email} autoComplete="email" placeholder="contato@exemplo.com" hint="Use um e-mail válido. No modo mock, não há envio de mensagens." />
      <Field id="senha" label="Senha (mínimo 8 caracteres)" type="password" value={form.senha} onChange={e => alterar('senha', e.target.value)} error={erros.senha} autoComplete="new-password" placeholder="Pelo menos 8 caracteres" />
      <Field id="confirmacao" label="Confirmar senha" type="password" value={form.confirmacao} onChange={e => alterar('confirmacao', e.target.value)} error={erros.confirmacao} autoComplete="new-password" placeholder="Repita a senha" />
      {erroGeral && <p className="alert alert--error" role="alert">{erroGeral}</p>}
      <button className="btn btn--red btn--wide" type="submit" disabled={enviando}>{enviando ? 'Criando cadastro...' : 'Criar usuário'}</button>
      <button className="btn btn--outline btn--wide" type="button" onClick={() => navigate('/entrar')}>Já tenho acesso, voltar ao login</button>
    </form>
  </AuthShell>;
}

export function PendingScreen({ usuario, theme, toggleTheme, onLogout }) {
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="REGISTER">
    <div className="pending-page"><div className="pending-icon">✓</div>
      <p className="eyebrow">SOLICITAÇÃO RECEBIDA</p>
      <h2 className="auth-title">Cadastro enviado!</h2>
      <p>Recebemos o cadastro de <strong>{usuario.nome}</strong>. Ele ficará aguardando a análise de um administrador.</p>
      <div className="pending-status"><span>Status da organização</span><strong>Pendente de aprovação</strong></div>
      <p className="field-hint">Até a aprovação, você não poderá publicar ou reservar doações. Esta simulação não envia notificações reais.</p>
      <button onClick={onLogout} className="btn btn--red btn--wide">Voltar ao login</button>
      <p className="helper-center">Para testar as funcionalidades já liberadas, utilize as contas demonstrativas aprovadas na tela de login.</p>
    </div>
  </AuthShell>;
}

export function ResetScreen({ theme, toggleTheme, onReset, navigate }) {
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [confirmar, setConfirmar] = useState('');
  const [msg, setMsg] = useState(''); const [erro, setErro] = useState(''); const [loading, setLoading] = useState(false);
  async function enviar(e) {
    e.preventDefault(); setErro(''); setMsg('');
    if (!emailValido(email)) return setErro('Informe um e-mail válido.');
    if (senha.length < 8) return setErro('A nova senha deve ter pelo menos 8 caracteres.');
    if (senha !== confirmar) return setErro('As senhas não coincidem.');
    setLoading(true);
    try { await onReset(email, senha); setMsg('Senha alterada nesta simulação. Você já pode fazer login.'); }
    catch (err) { setErro(err.message); }
    finally { setLoading(false); }
  }
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="LOGIN">
    <p className="eyebrow">ACESSO À PLATAFORMA</p><h2 className="auth-title">Recuperar senha</h2>
    <p className="auth-subtitle">Modo de demonstração: a senha é alterada localmente, sem enviar e-mail. O backend fará a recuperação segura na versão real.</p>
    <form className="auth-form" onSubmit={enviar} noValidate>
      <Field id="email" label="E-mail cadastrado" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <Field id="senha" label="Nova senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} />
      <Field id="confirmar" label="Confirme a nova senha" type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} />
      {erro && <p className="alert alert--error" role="alert">{erro}</p>}
      {msg && <p className="alert alert--success" role="status">{msg}</p>}
      <button disabled={loading} className="btn btn--red btn--wide" type="submit">{loading ? 'Alterando...' : 'Alterar senha (mock)'}</button>
      <button type="button" className="btn btn--outline btn--wide" onClick={() => navigate('/entrar')}>Voltar ao login</button>
    </form>
  </AuthShell>;
}

export function DemoScreen({ theme, toggleTheme, onDemo, onRestore, navigate }) {
  const [msg, setMsg] = useState('');
  async function restaurar() {
    if (!window.confirm('Restaurar os dados locais? Isso apagará os cadastros e doações feitos neste navegador.')) return;
    await onRestore(); setMsg('Os dados de demonstração foram restaurados.');
  }
  return <AuthShell theme={theme} toggleTheme={toggleTheme} tipo="LOGIN">
    <p className="eyebrow">AMBIENTE DE TESTES</p><h2 className="auth-title">Contas de demonstração</h2>
    <p className="auth-subtitle">Estas contas estão pré-aprovadas para testar os dois perfis. Nenhum dado é enviado a um servidor.</p>
    <div className="demo-account"><strong>Doador</strong><code>{dadosDemo.doador}</code><button className="btn btn--red" onClick={() => onDemo('DOADOR')}>Entrar como doador</button></div>
    <div className="demo-account"><strong>ONG</strong><code>{dadosDemo.ong}</code><button className="btn btn--red" onClick={() => onDemo('ONG')}>Entrar como ONG</button></div>
    <p className="field-hint">Senha inicial das duas contas: <strong>{dadosDemo.senha}</strong></p>
    <button className="btn btn--outline btn--wide" onClick={restaurar}>Restaurar dados de exemplo</button>
    {msg && <p className="alert alert--success" role="status">{msg}</p>}
    <button className="underlined" onClick={() => navigate('/entrar')}>Voltar ao login</button>
  </AuthShell>;
}
