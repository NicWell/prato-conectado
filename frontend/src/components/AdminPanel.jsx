import { useEffect, useRef, useState } from 'react';
import { decidirCadastro, detalharCadastro, listarCadastros } from '../services/admin.js';
import WorkspaceLayout from './WorkspaceLayout.jsx';
import './AdminPanel.css';

const PERFIS = { ONG: 'ONG', EMPRESA: 'Doador empresa', PESSOA_FISICA: 'Doador pessoa física' };
const STATUS = { PENDENTE: 'Pendente', APROVADA: 'Aprovado', REPROVADA: 'Reprovado' };
const STATUS_CLASSE = { APROVADA: 'status-tag--entregue', REPROVADA: 'status-tag--cancelada' };
const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const formatarData = valor => formatoData.format(new Date(valor));
const focarDetalhe = elemento => { elemento?.focus(); };

function StatusCadastro({ status }) {
  return <span className={`status-tag ${STATUS_CLASSE[status] ?? ''}`}>{STATUS[status]}</span>;
}

export default function AdminPanel({ usuario, tema, alternarTema, sair }) {
  const [filtros, setFiltros] = useState({ status: 'PENDENTE', perfil: '', busca: '', pagina: 1 });
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState({ itens: [], total: 0 });
  const [detalhe, setDetalhe] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [erroDecisao, setErroDecisao] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const tituloLista = useRef(null);
  const tamanhoPagina = lista.tamanho ?? 20;
  useEffect(() => {
    let ativo = true;
    listarCadastros(filtros).then(dados => { if (ativo) setLista(dados); })
      .catch(e => { if (ativo) { setLista({ itens: [], total: 0 }); setErro(e.message); } })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [filtros, revisao]);
  function filtrar(campo, valor) {
    setCarregando(true); setErro(''); setDetalhe(null);
    setFiltros(atual => ({ ...atual, [campo]: valor, ...(campo !== 'pagina' ? { pagina: 1 } : {}) }));
  }
  function recarregarLista() {
    setCarregando(true);
    setErro('');
    setRevisao(v => v + 1);
  }
  async function abrir(item) {
    setEnviando(true); setErro(''); setErroDecisao(''); setAviso(''); setDetalhe(null); setMotivo('');
    try { setDetalhe(await detalharCadastro(item.perfil, item.id)); }
    catch (e) { setErro(e.message); }
    finally { setEnviando(false); }
  }
  async function decidir(decisao) {
    if (decisao === 'REPROVADA' && !motivo.trim()) {
      setErroDecisao('Informe a justificativa da reprovação.');
      return;
    }
    if (!window.confirm(`Confirma ${decisao === 'APROVADA' ? 'a aprovação' : 'a reprovação'} de ${detalhe.nome}?`)) return;
    setEnviando(true); setErroDecisao(''); setAviso('');
    try {
      setDetalhe(await decidirCadastro(detalhe.perfil, detalhe.id, decisao, motivo));
      setAviso('Decisão registrada e situação do responsável atualizada.');
      recarregarLista();
    } catch (e) {
      if (e.status === 409) {
        setDetalhe(null);
        recarregarLista();
        setErro(e.message);
      } else {
        setErroDecisao(e.message);
      }
    } finally { setEnviando(false); }
  }
  return (
    <WorkspaceLayout
      tema={tema} alternarTema={alternarTema} sair={sair}
      perfil={`ADMINISTRAÇÃO · ${usuario.responsavel}`}
      rotuloSair="Sair"
      menu={<a href="#/admin/cadastros" className="sidebar-link sidebar-link--active admin-menu-link" aria-current="page">Cadastros</a>}
    >
      <div className="admin-panel">
        <header className="workspace-heading">
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1>Análise de cadastros</h1>
          <span className="gold-rule" />
          <p className="workspace-description">Consulte cadastros de ONGs e doadores e registre a decisão da análise.</p>
        </header>

        <form onSubmit={e => { e.preventDefault(); filtrar('busca', busca.trim()); }}>
          <fieldset className="admin-filters" aria-label="Filtros de cadastros" disabled={enviando}>
            <div className="field">
              <label htmlFor="admin-status">Status</label>
              <select id="admin-status" value={filtros.status} onChange={e => filtrar('status', e.target.value)}>
                {Object.entries(STATUS).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="admin-perfil">Perfil</label>
              <select id="admin-perfil" value={filtros.perfil} onChange={e => filtrar('perfil', e.target.value)}>
                <option value="">Todos os perfis</option>
                {Object.entries(PERFIS).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
              </select>
            </div>
            <div className="field admin-search">
              <label htmlFor="admin-busca">Nome ou e-mail</label>
              <input id="admin-busca" type="search" maxLength={180} value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <div className="action-row admin-filter-actions">
              <button className="btn btn--red" type="submit">Buscar</button>
              <button className="btn btn--outline" type="button" onClick={recarregarLista}>Atualizar</button>
            </div>
          </fieldset>
        </form>

        {erro && <p className="alert alert--error" role="alert">{erro}</p>}

        <div className="admin-columns">
          <section aria-labelledby="admin-lista" aria-busy={carregando}>
            <header className="admin-list-heading">
              <h2 id="admin-lista" tabIndex={-1} ref={tituloLista}>Cadastros</h2>
              {!carregando && <span>{lista.total} {lista.total === 1 ? 'resultado' : 'resultados'}</span>}
            </header>
            {carregando ? <p role="status">Consultando cadastros…</p> : lista.itens.length ? (
              <div className="admin-list">
                {lista.itens.map(item => (
                  <article className="admin-card" key={`${item.perfil}-${item.id}`}>
                    <div className="admin-card-heading">
                      <h3>{item.nome}</h3>
                      <StatusCadastro status={item.status} />
                    </div>
                    <p>{PERFIS[item.perfil]} · {item.cidade} – {item.uf}</p>
                    <p>{item.responsavel}<br />{item.email}</p>
                    <button
                      className="btn btn--outline btn--small"
                      disabled={enviando}
                      aria-label={`Ver cadastro de ${item.nome}`}
                      onClick={() => abrir(item)}
                    >Ver cadastro</button>
                  </article>
                ))}
              </div>
            ) : !erro && (
              <div className="empty-state">
                <h3>Nenhum cadastro encontrado</h3>
                <p>Altere o status, o perfil ou a busca para consultar outros cadastros.</p>
              </div>
            )}
            {(lista.total > tamanhoPagina || filtros.pagina > 1) && (
              <nav className="admin-pagination" aria-label="Páginas de cadastros">
                <button className="btn btn--outline btn--small" disabled={carregando || enviando || filtros.pagina === 1} onClick={() => filtrar('pagina', filtros.pagina - 1)}>Anterior</button>
                <span>Página {filtros.pagina}</span>
                <button className="btn btn--outline btn--small" disabled={carregando || enviando || filtros.pagina * tamanhoPagina >= lista.total} onClick={() => filtrar('pagina', filtros.pagina + 1)}>Próxima</button>
              </nav>
            )}
          </section>

          <section className="admin-detail" aria-label="Detalhes do cadastro" aria-busy={enviando}>
            {detalhe ? (
              <>
                <header className="admin-detail-heading">
                  <div>
                    <h2 tabIndex={-1} ref={focarDetalhe}>{detalhe.nome}</h2>
                    <p>{PERFIS[detalhe.perfil]}</p>
                  </div>
                  <StatusCadastro status={detalhe.status} />
                </header>
                {aviso && <p className="alert alert--success" role="status">{aviso}</p>}
                <dl className="admin-data">
                  {[
                    ['Responsável', detalhe.responsavel],
                    ['E-mail de acesso', detalhe.email],
                    [detalhe.perfil === 'PESSOA_FISICA' ? 'CPF' : 'CNPJ', detalhe.documento],
                    ['E-mail de contato', detalhe.email_contato],
                    ['Telefone', detalhe.telefone],
                    ['Cadastro enviado em', formatarData(detalhe.criado_em)],
                    ...(detalhe.capacidade_atendimento ? [['Capacidade de atendimento', detalhe.capacidade_atendimento]] : []),
                    ['Endereço', `${detalhe.logradouro}, ${detalhe.numero}${detalhe.complemento ? `, ${detalhe.complemento}` : ''}, ${detalhe.bairro}, ${detalhe.cidade} – ${detalhe.uf}, CEP ${detalhe.cep}`],
                  ].map(([titulo, valor]) => <div key={titulo}><dt>{titulo}</dt><dd>{valor}</dd></div>)}
                </dl>
                {detalhe.status === 'PENDENTE' && (
                  <div className="admin-detail-section">
                    <h3>Decisão da análise</h3>
                    <div className="field">
                      <label htmlFor="admin-motivo">Justificativa</label>
                      <textarea id="admin-motivo" aria-describedby="admin-motivo-dica" maxLength={2000} value={motivo} onChange={e => setMotivo(e.target.value)} disabled={enviando} />
                      <span id="admin-motivo-dica" className="field-hint">Obrigatória para reprovar o cadastro.</span>
                    </div>
                    <div className="action-row">
                      <button className="btn btn--red" disabled={enviando} onClick={() => decidir('APROVADA')}>Aprovar cadastro</button>
                      <button className="btn btn--outline" disabled={enviando} onClick={() => decidir('REPROVADA')}>Reprovar cadastro</button>
                    </div>
                    {erroDecisao && <p className="alert alert--error" role="alert">{erroDecisao}</p>}
                  </div>
                )}
                <div className="admin-detail-section">
                  <h3>Histórico de análise</h3>
                  {detalhe.historico.length ? detalhe.historico.map(analise => (
                    <article className="admin-history" key={analise.id}>
                      <StatusCadastro status={analise.decisao} />
                      <time dateTime={analise.analisado_em}>{formatarData(analise.analisado_em)}</time>
                      {analise.justificativa && <p>{analise.justificativa}</p>}
                    </article>
                  )) : <p>Ainda não analisado.</p>}
                </div>
                <button className="btn btn--outline btn--small" disabled={enviando} onClick={() => {
                  setDetalhe(null);
                  requestAnimationFrame(() => tituloLista.current?.focus());
                }}>Voltar à lista</button>
              </>
            ) : (
              <p role={enviando ? 'status' : undefined}>{enviando ? 'Carregando cadastro…' : 'Selecione um cadastro para consultar os dados e o histórico.'}</p>
            )}
          </section>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
