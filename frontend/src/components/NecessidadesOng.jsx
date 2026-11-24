import { useState } from 'react';
import { UNIDADES_ALIMENTO } from '../utils/formularios.js';

export default function NecessidadesOng({ dados, salvar, desativar }) {
  const [editando, setEditando] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const { categorias, itens } = dados;

  async function executar(acao) {
    setOcupado(true);
    setErro('');
    try {
      await acao();
    } catch (falha) {
      setErro(Object.values(falha.fields ?? {})[0] || falha.message);
    } finally {
      setOcupado(false);
    }
  }

  function enviar(evento) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const valores = Object.fromEntries(new FormData(form));
    executar(async () => {
      await salvar(editando?.id, valores);
      form.reset();
      setEditando(null);
    });
  }

  return <>
    <header className="workspace-heading"><h1>Necessidades da ONG</h1></header>
    {erro && <p className="alert alert--error" role="alert">{erro}</p>}
    <form className="wizard-card" key={editando?.id ?? 'nova'} onSubmit={enviar}>
      <h2>{editando ? 'Editar necessidade' : 'Nova necessidade'}</h2>
      <fieldset className="necessidade-campos" disabled={ocupado || !categorias.length}>
        <div className="form-grid form-grid--three">
          <label className="field">Categoria
            <select name="categoria" required defaultValue={categorias.includes(editando?.categoria) ? editando.categoria : ''}>
              <option value="" disabled>Selecione</option>
              {categorias.map(categoria => <option key={categoria}>{categoria}</option>)}
            </select>
          </label>
          <label className="field">Quantidade desejada
            <input name="quantidade" type="number" min="0.001" max="999999999.999" step="0.001" required defaultValue={editando?.quantidade} />
          </label>
          <label className="field">Unidade
            <select name="unidade" defaultValue={editando?.unidade ?? 'kg'}>
              {UNIDADES_ALIMENTO.map(unidade => <option key={unidade}>{unidade}</option>)}
            </select>
          </label>
        </div>
        <label className="field">Observação (opcional)
          <input name="observacao" maxLength={500} defaultValue={editando?.observacao ?? ''} />
        </label>
        <div className="action-row">
          <button className="btn btn--red" type="submit">{editando ? 'Salvar alterações' : 'Cadastrar necessidade'}</button>
          {editando && <button className="btn btn--outline" type="button" onClick={() => setEditando(null)}>Cancelar edição</button>}
        </div>
      </fieldset>
      {!categorias.length && <p>Nenhuma categoria ativa disponível.</p>}
    </form>
    {itens.length ? <div className="donations-list">
      {itens.map(item => <article className="donation-card" key={item.id}>
        <div className="donation-card__details">
          <h3>{item.categoria}</h3>
          <p>{item.quantidade} {item.unidade} · {item.ativa ? 'Ativa' : 'Inativa'}</p>
          {item.observacao && <p>{item.observacao}</p>}
        </div>
        {item.ativa && <div className="donation-card__actions">
          <button className="btn btn--outline btn--small" type="button" disabled={ocupado} onClick={() => setEditando(item)}>Editar</button>
          <button className="btn btn--outline btn--small" type="button" disabled={ocupado} onClick={() => {
            if (window.confirm('Desativar esta necessidade?')) executar(async () => {
              await desativar(item.id);
              if (editando?.id === item.id) setEditando(null);
            });
          }}>Desativar</button>
        </div>}
      </article>)}
    </div> : <p>Nenhuma necessidade cadastrada.</p>}
  </>;
}
