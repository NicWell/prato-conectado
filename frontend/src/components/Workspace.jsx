import { useState } from 'react';
import { Logo } from './AuthScreens.jsx';
import { dataLocal, dataMaisDias, formatarData, validarDoacao } from '../utils/formularios.js';

const CATEGORIAS = ['Refeições prontas', 'Frutas e verduras', 'Pães e massas', 'Laticínios', 'Não perecíveis', 'Outros'];
const UNIDADES = ['porções', 'kg', 'unidades', 'litros', 'caixas'];
const CHECKS = [
  ['temperatura', 'Alimento em temperatura segura'],
  ['embalagem', 'Embalagem fechada e identificada'],
  ['validade', 'Alimento dentro da validade'],
  ['conservacao', 'Sem sinais de estrago'],
  ['termo', 'Li e aceito o termo de responsabilidade'],
];
const vazio = () => ({ categoria: 'Refeições prontas', descricao: '', quantidade: '1', unidade: 'porções',
  validade: dataMaisDias(3), entrega: 'RETIRADA', retiradaData: dataMaisDias(1),
  retiradaInicio: '10:00', retiradaFim: '12:00', checklist: Object.fromEntries(CHECKS.map(([key]) => [key, false])) });
function Etiqueta({ status }) {
  const map = { DISPONIVEL: 'Disponível', RESERVADA: 'Reservada', RETIRADA: 'Retirada', ENTREGUE: 'Entregue', CANCELADA: 'Cancelada', ENCERRADA: 'Encerrada' };
  return <span className={`status-tag status-tag--${status.toLowerCase()}`}>{map[status] || status}</span>;
}
function Intro({ name, subtitle, children }) {
  return <header className="workspace-heading">
    <p className="eyebrow">{subtitle}</p><h1>{name}</h1><span className="gold-rule" />{children && <p className="workspace-description">{children}</p>}
  </header>;
}
function CartaoDoacao({ doacao, children }) {
  return <article className="donation-card">
    <div className="donation-card__details">
      <h3>{doacao.descricao}</h3>
      <p>{doacao.quantidade} {doacao.unidade} · validade {formatarData(doacao.validade)} · {doacao.entrega === 'RETIRADA' ? 'retirada pela ONG' : 'entrega pelo doador'} {formatarData(doacao.retiradaData)}, {doacao.retiradaInicio}–{doacao.retiradaFim}</p>
      <small>{doacao.categoria} · Doador: {doacao.doadorNome}{doacao.ongNome ? ` · ONG: ${doacao.ongNome}` : ''}</small>
    </div>
    <div className="donation-card__actions"><Etiqueta status={doacao.status}/>{children}</div>
  </article>;
}
function Kpi({ numero, titulo }) {
  return <div className="kpi"><strong>{numero}</strong><span>{titulo}</span></div>;
}
function DashboardDoador({ usuario, doacoes, navigate }) {
  const minhas = doacoes.filter(d => d.doadorId === usuario.id);
  return <>
    <Intro subtitle="DOADOR" name={`Olá, ${usuario.responsavel}`}>Resumo das suas doações</Intro>
    <div className="kpi-grid">
      <Kpi numero={minhas.length} titulo="Doações publicadas" />
      <Kpi numero={minhas.filter(d => d.status === 'DISPONIVEL').length} titulo="Disponíveis" />
      <Kpi numero={minhas.filter(d => d.status === 'RESERVADA' || d.status === 'RETIRADA').length} titulo="Reservadas por ONGs" />
      <Kpi numero={minhas.filter(d => d.status === 'ENTREGUE').length} titulo="Entregues" />
    </div>
    <div className="action-row">
      <button className="btn btn--red" onClick={() => navigate('/app/nova-doacao')}>Nova doação</button>
      <button className="btn btn--outline" onClick={() => navigate('/app/doacoes')}>Minhas doações</button>
    </div>
    <div className="dashboard-help"><h3>Faça a diferença com seus alimentos</h3><p>Publique uma doação, informe a janela de retirada e aguarde uma ONG reservar. Você pode acompanhar cada etapa em “Minhas doações”.</p></div>
  </>;
}
function MinhasDoacoes({ usuario, doacoes, navigate, atualizar }) {
  const minhas = doacoes.filter(d => d.doadorId === usuario.id);
  const [filtro, setFiltro] = useState('TODAS');
  const filtradas = filtro === 'TODAS' ? minhas : minhas.filter(d => d.status === filtro);
  return <>
    <Intro subtitle="DOADOR" name="Minhas doações">HU06–HU09 · Acompanhe as ofertas e os recebimentos</Intro>
    <div className="toolbar"><button className="btn btn--red" onClick={() => navigate('/app/nova-doacao')}>Nova doação</button>
      <select aria-label="Filtrar por status" className="toolbar-select" value={filtro} onChange={e => setFiltro(e.target.value)}>
        <option value="TODAS">Todos os status</option>{['DISPONIVEL', 'RESERVADA', 'RETIRADA', 'ENTREGUE', 'CANCELADA'].map(s => <option value={s} key={s}>{s}</option>)}
      </select>
    </div>
    {filtradas.length ? <div className="donations-list">{filtradas.map(d => <CartaoDoacao doacao={d} key={d.id}>
      {d.status === 'DISPONIVEL' && <button className="btn btn--outline btn--small" onClick={() => {
        if (window.confirm('Deseja cancelar esta doação?')) atualizar(d.id, 'CANCELAR');
      }}>Cancelar</button>}
    </CartaoDoacao>)}</div> : <div className="empty-state"><h3>Nenhuma doação encontrada</h3><p>Quando você publicar alimentos, eles aparecerão aqui.</p><button className="btn btn--red" onClick={() => navigate('/app/nova-doacao')}>Cadastrar primeira doação</button></div>}
  </>;
}
function StepField({ id, label, erro, children }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{erro && <small className="field-error" role="alert">{erro}</small>}</div>;
}
function DoacaoWizard({ publicar, navigate }) {
  const [passo, setPasso] = useState(1);
  const [form, setForm] = useState(vazio);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [mostraTermo, setMostraTermo] = useState(false);
  function alterar(id, valor) { setForm(v => ({ ...v, [id]: valor })); setErros(e => ({ ...e, [id]: '' })); }
  function proximo(e) {
    e.preventDefault(); const e2 = validarDoacao(form, passo); setErros(e2);
    if (Object.keys(e2).length) return;
    if (passo < 3) { setPasso(passo + 1); return; }
    try { publicar(form); navigate('/app/doacoes'); }
    catch (err) { setErroGeral(err.message); }
  }
  return <>
    <Intro subtitle="DOADOR" name="Nova doação">HU06 · HU07 · Passo {passo} de 3</Intro>
    <div className="step-progress" aria-label={`Etapa ${passo} de 3`}>{[1,2,3].map(x => <span key={x} className={x <= passo ? 'step-progress--on' : ''} />)}</div>
    <form onSubmit={proximo} noValidate>
      <div className="wizard-card">
      {passo === 1 && <><h2>Alimento</h2><div className="form-grid form-grid--three">
        <StepField id="categoria" label="Tipo de alimento" erro={erros.categoria}><select id="categoria" value={form.categoria} onChange={e => alterar('categoria', e.target.value)}>{CATEGORIAS.map(x => <option key={x}>{x}</option>)}</select></StepField>
        <StepField id="descricao" label="Descrição (ex.: arroz e feijão)" erro={erros.descricao}><input id="descricao" placeholder="Arroz e feijão" value={form.descricao} onChange={e => alterar('descricao', e.target.value)} maxLength="120" /></StepField>
        <StepField id="quantidade" label="Quantidade" erro={erros.quantidade}><input id="quantidade" type="number" min="0.01" step="any" value={form.quantidade} onChange={e => alterar('quantidade', e.target.value)} /></StepField>
        <StepField id="unidade" label="Unidade" erro={erros.unidade}><select id="unidade" value={form.unidade} onChange={e => alterar('unidade', e.target.value)}>{UNIDADES.map(x => <option key={x}>{x}</option>)}</select></StepField>
        <StepField id="validade" label="Validade" erro={erros.validade}><input id="validade" type="date" min={dataLocal()} value={form.validade} onChange={e => alterar('validade', e.target.value)} /></StepField>
      </div></>}
      {passo === 2 && <><h2>Retirada ou entrega</h2><div className="form-grid">
        <StepField id="entrega" label="Como a doação chega à ONG?"><select id="entrega" value={form.entrega} onChange={e => alterar('entrega', e.target.value)}><option value="RETIRADA">A ONG retira no meu endereço</option><option value="ENTREGA">Eu entrego para a ONG (combinar endereço)</option></select></StepField>
      </div><div className="form-grid form-grid--three">
        <StepField id="retiradaData" label="Data da retirada" erro={erros.retiradaData}><input id="retiradaData" type="date" min={dataLocal()} max={form.validade} value={form.retiradaData} onChange={e => alterar('retiradaData', e.target.value)} /></StepField>
        <StepField id="retiradaInicio" label="Horário inicial" erro={erros.retiradaInicio}><input id="retiradaInicio" type="time" value={form.retiradaInicio} onChange={e => alterar('retiradaInicio', e.target.value)} /></StepField>
        <StepField id="retiradaFim" label="Horário final" erro={erros.retiradaFim}><input id="retiradaFim" type="time" value={form.retiradaFim} onChange={e => alterar('retiradaFim', e.target.value)} /></StepField>
      </div></>}
      {passo === 3 && <><h2>Termo e checklist do doador</h2><div className="checklist">{CHECKS.map(([key, texto]) => <label key={key} className="checklist-item"><input type="checkbox" checked={form.checklist[key]} onChange={e => setForm(o => ({...o, checklist: {...o.checklist, [key]: e.target.checked}}))} /><span>{texto}</span></label>)}</div>
        <button type="button" className="link-button term-link" onClick={() => setMostraTermo(v => !v)}>{mostraTermo ? 'Ocultar termo' : 'Ler termo de responsabilidade (versão demonstrativa)'}</button>
        {mostraTermo && <div className="term-panel"><strong>Termo de responsabilidade — texto provisório</strong><p>O doador declara que as informações fornecidas são verdadeiras e que os alimentos estão próprios para consumo, conservados adequadamente e dentro da validade. O texto jurídico definitivo deverá ser aprovado pela equipe antes de uso em produção.</p></div>}
        {erros.checklist && <p className="field-error" role="alert">{erros.checklist}</p>}
      </>}
      </div>
      {erroGeral && <p className="alert alert--error" role="alert">{erroGeral}</p>}
      <div className="wizard-actions"><button type="button" className="btn btn--outline" onClick={() => passo === 1 ? navigate('/app/inicio') : (setErros({}), setPasso(x => x - 1))}>Voltar</button>
        <button className="btn btn--red" type="submit">{passo === 3 ? 'Publicar doação' : 'Continuar'}</button>
      </div>
    </form>
  </>;
}
function DashboardOng({ usuario, doacoes, navigate }) {
  const minhas = doacoes.filter(d => d.ongId === usuario.id);
  return <>
    <Intro subtitle="ONG" name={`Olá, ${usuario.responsavel}`}>Visão geral das oportunidades de recebimento</Intro>
    <div className="kpi-grid">
      <Kpi numero={doacoes.filter(d => d.status === 'DISPONIVEL' && d.retiradaData >= dataLocal()).length} titulo="Ofertas disponíveis" />
      <Kpi numero={minhas.filter(d => d.status === 'RESERVADA').length} titulo="Minhas reservas" />
      <Kpi numero={minhas.filter(d => d.status === 'RETIRADA').length} titulo="Retiradas" />
      <Kpi numero={minhas.filter(d => d.status === 'ENTREGUE').length} titulo="Entregues" />
    </div>
    <div className="action-row"><button className="btn btn--red" onClick={() => navigate('/app/oportunidades')}>Ver doações disponíveis</button><button className="btn btn--outline" onClick={() => navigate('/app/reservas')}>Minhas reservas</button></div>
    <div className="dashboard-help"><h3>Conectando quem doa a quem precisa</h3><p>Consulte ofertas de alimentos, reserve uma doação e acompanhe a retirada e a entrega. Tudo isso está disponível em modo de demonstração.</p></div>
  </>;
}
function Oportunidades({ doacoes, atualizar }) {
  const [busca, setBusca] = useState(''); const [categoria, setCategoria] = useState('TODAS');
  const ofertas = doacoes.filter(d => d.status === 'DISPONIVEL' && d.retiradaData >= dataLocal())
    .filter(d => (categoria === 'TODAS' || d.categoria === categoria) && `${d.descricao} ${d.doadorNome}`.toLowerCase().includes(busca.toLowerCase()));
  return <><Intro subtitle="ONG" name="Doações disponíveis">Encontre alimentos para sua organização</Intro>
    <div className="toolbar"><input aria-label="Buscar alimentos" placeholder="Buscar alimento ou doador" value={busca} onChange={e => setBusca(e.target.value)} />
      <select aria-label="Filtrar categoria" className="toolbar-select" value={categoria} onChange={e => setCategoria(e.target.value)}><option value="TODAS">Todas as categorias</option>{CATEGORIAS.map(x => <option key={x}>{x}</option>)}</select>
    </div>
    {ofertas.length ? <div className="donations-list">{ofertas.map(d => <CartaoDoacao key={d.id} doacao={d}><button className="btn btn--red btn--small" onClick={() => atualizar(d.id, 'RESERVAR')}>Reservar</button></CartaoDoacao>)}</div> : <div className="empty-state"><h3>Nenhuma oferta disponível</h3><p>Quando um doador publicar alimentos, as oportunidades aparecerão aqui. Entre como doador demonstrativo para publicar uma oferta.</p></div>}
  </>;
}
function ReservasOng({ usuario, doacoes, atualizar, navigate }) {
  const minhas = doacoes.filter(d => d.ongId === usuario.id);
  return <><Intro subtitle="ONG" name="Minhas reservas">Acompanhe a retirada e a entrega das doações</Intro>
    {minhas.length ? <div className="donations-list">{minhas.map(d => <CartaoDoacao key={d.id} doacao={d}>
      {d.status === 'RESERVADA' && <button className="btn btn--red btn--small" onClick={() => atualizar(d.id, 'RETIRAR')}>Confirmar retirada</button>}
      {d.status === 'RETIRADA' && <button className="btn btn--red btn--small" onClick={() => atualizar(d.id, 'ENTREGAR')}>Confirmar entrega</button>}
    </CartaoDoacao>)}</div> : <div className="empty-state"><h3>Você ainda não reservou doações</h3><p>Acesse as oportunidades e escolha uma oferta disponível.</p><button className="btn btn--red" onClick={() => navigate('/app/oportunidades')}>Ver oportunidades</button></div>}
  </>;
}
export default function Workspace({ usuario, tema, alternarTema, rota, navegar, sair, doacoes, publicar, atualizar }) {
  const ong = usuario.tipo === 'ONG';
  const links = ong ? [['/app/inicio', 'Início'], ['/app/oportunidades', 'Doações disponíveis'], ['/app/reservas', 'Minhas reservas']] : [['/app/inicio', 'Início'], ['/app/doacoes', 'Minhas doações'], ['/app/nova-doacao', 'Nova doação']];
  return <div className={`workspace theme-${tema}`}>
    <aside className="sidebar"><div className="sidebar__logo"><Logo /></div>
      <nav className="sidebar-nav" aria-label="Menu principal">{links.map(([path, label]) => <button key={path} type="button" className={`sidebar-link ${rota === path ? 'sidebar-link--active' : ''}`} onClick={() => navegar(path)}>{label}</button>)}</nav>
      <div className="sidebar-bottom"><span className="sidebar-profile">{ong ? 'ONG' : 'DOADOR'} · {usuario.nome}</span><button type="button" onClick={sair} className="sidebar-logout">Sair ({ong ? 'ONG' : 'Doador'})</button></div>
    </aside>
    <main className="workspace-main"><button type="button" className="theme-switch workspace-theme-switch" onClick={alternarTema}>Modo {tema === 'dark' ? 'claro' : 'escuro'}</button>
      <div className="workspace-body">
        {ong ? (
          rota === '/app/oportunidades' ? <Oportunidades doacoes={doacoes} atualizar={atualizar} /> :
          rota === '/app/reservas' ? <ReservasOng usuario={usuario} doacoes={doacoes} atualizar={atualizar} navigate={navegar} /> :
          <DashboardOng usuario={usuario} doacoes={doacoes} navigate={navegar} />
        ) : (
          rota === '/app/doacoes' ? <MinhasDoacoes usuario={usuario} doacoes={doacoes} atualizar={atualizar} navigate={navegar} /> :
          rota === '/app/nova-doacao' ? <DoacaoWizard key={usuario.id} publicar={publicar} navigate={navegar} /> :
          <DashboardDoador usuario={usuario} doacoes={doacoes} navigate={navegar} />
        )}
      </div>
    </main>
  </div>;
}
