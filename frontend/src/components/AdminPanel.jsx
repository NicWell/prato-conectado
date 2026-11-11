import { useEffect, useState } from 'react';
import { decidirCadastro, detalharCadastro, listarCadastros } from '../services/admin.js';
import './AdminPanel.css';

const PERFIS = { ONG: 'ONG', EMPRESA: 'Doador empresa', PESSOA_FISICA: 'Doador pessoa física' };
const STATUS = { PENDENTE: 'Pendente', APROVADA: 'Aprovado', REPROVADA: 'Reprovado' };

export default function AdminPanel({ usuario, tema, alternarTema, sair }) {
  const [filtros, setFiltros] = useState({ status: 'PENDENTE', perfil: '', busca: '', pagina: 1 });
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState({ itens: [], total: 0 });
  const [detalhe, setDetalhe] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [revisao, setRevisao] = useState(0);
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
  async function abrir(item) {
    setEnviando(true); setErro(''); setAviso(''); setDetalhe(null); setMotivo('');
    try { setDetalhe(await detalharCadastro(item.perfil, item.id)); }
    catch (e) { setErro(e.message); }
    finally { setEnviando(false); }
  }
  async function decidir(decisao) {
    if (decisao === 'REPROVADA' && !motivo.trim()) { setErro('Informe a justificativa da reprovação.'); return; }
    if (!window.confirm(`Confirma ${decisao === 'APROVADA' ? 'a aprovação' : 'a reprovação'} de ${detalhe.nome}?`)) return;
    setEnviando(true); setErro(''); setAviso('');
    try {
      setDetalhe(await decidirCadastro(detalhe.perfil, detalhe.id, decisao, motivo));
      setAviso('Decisão registrada e situação do responsável atualizada.');
      setCarregando(true); setRevisao(v => v + 1);
    } catch (e) {
      setErro(e.message);
      if (e.status === 409) { setDetalhe(null); setCarregando(true); setRevisao(v => v + 1); }
    } finally { setEnviando(false); }
  }
  return <div className={`workspace admin-panel theme-${tema}`}>
    <header className="admin-header"><div><p className="eyebrow">PRATO CONECTADO · ADMINISTRAÇÃO</p><h1>Análise de cadastros</h1><p>{usuario.responsavel} · {usuario.email}</p></div>
      <div className="action-row"><button className="theme-switch" onClick={alternarTema}>Alternar tema</button><button className="btn btn--outline" onClick={sair}>Sair</button></div>
    </header>
    <form className="admin-filters" onSubmit={e => { e.preventDefault(); filtrar('busca', busca.trim()); }}>
      <label>Status<select value={filtros.status} onChange={e => filtrar('status', e.target.value)}>{Object.entries(STATUS).map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}</select></label>
      <label>Perfil<select value={filtros.perfil} onChange={e => filtrar('perfil', e.target.value)}><option value="">Todos os perfis</option>{Object.entries(PERFIS).map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}</select></label>
      <label>Nome ou e-mail<input maxLength={180} value={busca} onChange={e => setBusca(e.target.value)} /></label><button className="btn btn--red" type="submit">Buscar</button>
      <button className="btn btn--outline" type="button" onClick={() => { setCarregando(true); setErro(''); setRevisao(v => v + 1); }}>Atualizar</button>
    </form>
    {erro && <p className="alert alert--error" role="alert">{erro}</p>}{aviso && <p className="alert alert--success" role="status">{aviso}</p>}
    <div className="admin-columns"><section aria-label="Cadastros encontrados" aria-busy={carregando}>
      <h2>{lista.total} cadastro(s)</h2>
      {carregando ? <p role="status">Consultando cadastros...</p> : lista.itens.length ? lista.itens.map(item => <article className="admin-card" key={`${item.perfil}-${item.id}`}>
        <h3>{item.nome}</h3><p>{PERFIS[item.perfil]} · {STATUS[item.status]}</p><p>{item.responsavel} · {item.email}</p><p>{item.cidade} – {item.uf}</p>
        <button className="btn btn--outline" disabled={enviando} onClick={() => abrir(item)}>Ver cadastro</button>
      </article>) : <p>Nenhum cadastro encontrado para estes filtros.</p>}
      <div className="action-row"><button className="btn btn--outline" disabled={carregando || filtros.pagina === 1} onClick={() => filtrar('pagina', filtros.pagina - 1)}>Anterior</button><span>Página {filtros.pagina}</span><button className="btn btn--outline" disabled={carregando || filtros.pagina * 20 >= lista.total} onClick={() => filtrar('pagina', filtros.pagina + 1)}>Próxima</button></div>
    </section><section aria-label="Detalhes do cadastro" className="admin-detail">
      {!detalhe ? <p>Selecione um cadastro para consultar os dados e registrar a decisão.</p> : <>
        <h2>{detalhe.nome}</h2><p>{PERFIS[detalhe.perfil]} · {STATUS[detalhe.status]}</p>
        <dl>{[
          ['Responsável', detalhe.responsavel], ['E-mail de acesso', detalhe.email],
          [detalhe.perfil === 'PESSOA_FISICA' ? 'CPF' : 'CNPJ', detalhe.documento],
          ['E-mail de contato', detalhe.email_contato], ['Telefone', detalhe.telefone],
          ['Endereço', `${detalhe.logradouro}, ${detalhe.numero}${detalhe.complemento ? `, ${detalhe.complemento}` : ''}, ${detalhe.bairro}, ${detalhe.cidade} – ${detalhe.uf}, CEP ${detalhe.cep}`],
          ['Cadastro enviado em', new Date(detalhe.criado_em).toLocaleString('pt-BR')],
          ...(detalhe.capacidade_atendimento ? [['Capacidade de atendimento', detalhe.capacidade_atendimento]] : []),
        ].map(([titulo, valor]) => <div key={titulo}><dt>{titulo}</dt><dd>{valor}</dd></div>)}</dl>
        {detalhe.status === 'PENDENTE' && <><label className="admin-reason">Justificativa (obrigatória para reprovar)<textarea maxLength={2000} value={motivo} onChange={e => setMotivo(e.target.value)} disabled={enviando} /></label>
          <div className="action-row"><button className="btn btn--red" disabled={enviando} onClick={() => decidir('APROVADA')}>Aprovar cadastro</button><button className="btn btn--outline" disabled={enviando} onClick={() => decidir('REPROVADA')}>Reprovar cadastro</button></div></>}
        <h3>Histórico de análise</h3>{detalhe.historico.length ? detalhe.historico.map(analise => <article key={analise.id}><strong>{STATUS[analise.decisao]}</strong><p>{new Date(analise.analisado_em).toLocaleString('pt-BR')}</p>{analise.justificativa && <p>{analise.justificativa}</p>}</article>) : <p>Ainda não analisado.</p>}
      </>}
    </section></div>
  </div>;
}
