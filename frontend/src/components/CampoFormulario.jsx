export default function CampoFormulario({ id, label, erro, dica, ...props }) {
  return (
    <div className="campo-formulario">
      <label htmlFor={id} className="campo-formulario__label">
        {label} <span aria-hidden="true" className="campo-formulario__obrigatorio">*</span>
      </label>
      <input
        id={id}
        name={id}
        className={`campo-formulario__input${erro ? " campo-formulario__input--erro" : ""}`}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? `${id}-erro` : dica ? `${id}-dica` : undefined}
        required
        {...props}
      />
      {erro ? (
        <span id={`${id}-erro`} className="campo-formulario__erro" role="alert">
          {erro}
        </span>
      ) : dica ? (
        <span id={`${id}-dica`} className="campo-formulario__dica">{dica}</span>
      ) : null}
    </div>
  );
}
