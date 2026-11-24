import { useState } from 'react';
import { ESTADOS } from '../utils/cadastro.js';
import { CAMPOS_VOLUNTARIO, validarVoluntario } from '../utils/voluntarios.js';

export default function VoluntariosOng({ voluntarios, cadastrar }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [erros, setErros] = useState({});

  function limparErro(nome) {
    setErros(atuais => ({ ...atuais, [nome]: undefined }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const dados = Object.fromEntries(Array.from(new FormData(form), ([nome, valor]) => [nome, valor.trim()]));
    const invalidos = validarVoluntario(dados);
    setErro('');
    setErros(invalidos);
    if (Object.keys(invalidos).length) {
      form.elements.namedItem(Object.keys(invalidos)[0])?.focus();
      return;
    }
    dados.email ||= null;
    setOcupado(true);
    try {
      await cadastrar(dados);
      form.reset();
    } catch (falha) {
      setErros(falha.fields ?? {});
      setErro(falha.message);
    } finally {
      setOcupado(false);
    }
  }

  return <>
    <header className="workspace-heading"><h1>Voluntários da ONG</h1></header>
    {erro && <p className="alert alert--error" role="alert">{erro}</p>}
    <form className="wizard-card" onSubmit={enviar} noValidate>
      <h2>Novo voluntário</h2>
      <fieldset className="necessidade-campos" disabled={ocupado}>
        <div className="form-grid form-grid--three">
          {CAMPOS_VOLUNTARIO.map(({ nome, rotulo, limite, tipo = 'text', mascara, inputMode, autoComplete, exemplo }) =>
            <label className="field" key={nome}>{rotulo}
              <input name={nome} type={tipo} maxLength={limite} required={nome !== 'email'}
                inputMode={inputMode} autoComplete={autoComplete} placeholder={exemplo}
                aria-invalid={Boolean(erros[nome])} aria-describedby={erros[nome] ? `voluntario-${nome}-erro` : undefined}
                onChange={evento => {
                  if (mascara) evento.target.value = mascara(evento.target.value);
                  limparErro(nome);
                }} />
              {erros[nome] && <small id={`voluntario-${nome}-erro`} className="field-error" role="alert">{erros[nome]}</small>}
            </label>
          )}
          <label className="field">UF
            <select name="uf" required defaultValue="" autoComplete="address-level1"
              aria-invalid={Boolean(erros.uf)} aria-describedby={erros.uf ? 'voluntario-uf-erro' : undefined}
              onChange={() => limparErro('uf')}>
              <option value="" disabled>Selecione</option>
              {ESTADOS.map(uf => <option key={uf}>{uf}</option>)}
            </select>
            {erros.uf && <small id="voluntario-uf-erro" className="field-error" role="alert">{erros.uf}</small>}
          </label>
        </div>
        <button className="btn btn--red" type="submit">{ocupado ? 'Cadastrando…' : 'Cadastrar voluntário'}</button>
      </fieldset>
    </form>
    {voluntarios.length ? <div className="donations-list">
      {voluntarios.map(voluntario => <article className="donation-card" key={voluntario.id}>
        <div className="donation-card__details">
          <h3>{voluntario.nome}</h3>
          <p>{voluntario.telefone}{voluntario.email ? ` · ${voluntario.email}` : ''}</p>
          <p>{voluntario.logradouro}, {voluntario.numero} · {voluntario.bairro} · {voluntario.cidade}/{voluntario.uf} · {voluntario.cep}</p>
        </div>
      </article>)}
    </div> : <p>Nenhum voluntário cadastrado.</p>}
  </>;
}
