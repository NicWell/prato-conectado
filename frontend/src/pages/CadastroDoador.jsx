import { useState } from "react";
import CampoFormulario from "../components/CampoFormulario";
import { cadastrarDoador } from "../services/organizacoes";
import { formatarCnpj, validarCadastro } from "../utils/validacoes";
import "./CadastroDoador.css";

const formularioVazio = { nome: "", cnpj: "", endereco: "", contato: "" };

export default function CadastroDoador() {
  const [dados, setDados] = useState(formularioVazio);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const [resultado, setResultado] = useState(null);

  function alterarCampo(evento) {
    const { name, value } = evento.target;
    const novoValor = name === "cnpj" ? formatarCnpj(value) : value;

    setDados((anterior) => ({ ...anterior, [name]: novoValor }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
    setErroGeral("");
  }

  function validarAoSair(evento) {
    const nomeCampo = evento.target.name;
    const novosErros = validarCadastro(dados);
    setErros((anterior) => ({ ...anterior, [nomeCampo]: novosErros[nomeCampo] }));
  }

  async function enviarFormulario(evento) {
    evento.preventDefault();
    if (enviando) return;

    const novosErros = validarCadastro(dados);
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setEnviando(true);
    setErroGeral("");
    try {
      const resposta = await cadastrarDoador(dados);
      const status = String(
        resposta.status_aprovacao ?? resposta.status ?? resposta.organizacao?.status ?? ""
      ).toUpperCase();
      setResultado({ status, simulado: resposta.simulado, nome: dados.nome.trim() });
    } catch (erro) {
      setErroGeral(erro.message || "Falha inesperada ao enviar o formulário.");
    } finally {
      setEnviando(false);
    }
  }

  function novoCadastro() {
    setDados(formularioVazio);
    setErros({});
    setErroGeral("");
    setResultado(null);
  }

  return (
    <main className="pagina-cadastro">
      <div className="cadastro-layout">
        <section className="cadastro-intro" aria-label="Sobre o cadastro">
          <a className="marca" href="/" aria-label="Prato Conectado, início">
            <span className="marca__simbolo" aria-hidden="true">✳</span>
            <span>Prato <strong>Conectado</strong></span>
          </a>
          <p className="cadastro-intro__etiqueta">FAÇA PARTE DA REDE</p>
          <h1>Alimentos podem chegar mais longe.</h1>
          <p className="cadastro-intro__texto">
            Cadastre seu estabelecimento para conectar alimentos disponíveis
            a organizações que ajudam quem mais precisa.
          </p>
          <div className="cadastro-beneficio">
            <span aria-hidden="true">✓</span>
            <p>Cadastro gratuito, simples e sujeito à aprovação da equipe.</p>
          </div>
        </section>

        <section className="cadastro-cartao" aria-labelledby="titulo-formulario">
          {resultado ? (
            <div className="cadastro-sucesso" role="status" aria-live="polite">
              <div className="cadastro-sucesso__icone" aria-hidden="true">✓</div>
              <h2 id="titulo-formulario">
                {resultado.simulado ? "Simulação concluída!" : "Cadastro enviado!"}
              </h2>
              <p>
                {resultado.simulado
                  ? "Este foi apenas um teste visual. Nenhum cadastro foi salvo no servidor."
                  : `Recebemos a solicitação de ${resultado.nome}. Nossa equipe analisará os dados.`}
              </p>
              <div className="cadastro-status">
                <span>Status</span>
                <strong>
                  {resultado.simulado || resultado.status === "PENDENTE"
                    ? "Pendente de aprovação"
                    : "Enviado para análise"}
                </strong>
              </div>
              <p className="cadastro-sucesso__observacao">
                O estabelecimento só poderá oferecer doações após a aprovação.
              </p>
              <button className="botao-secundario" type="button" onClick={novoCadastro}>
                Fazer outro cadastro
              </button>
            </div>
          ) : (
            <>
              <p className="cadastro-cartao__etiqueta">CADASTRO DE DOADOR</p>
              <h2 id="titulo-formulario">Conte sobre seu estabelecimento</h2>
              <p className="cadastro-cartao__descricao">
                Preencha os dados abaixo. Todos os campos são obrigatórios.
              </p>

              <form onSubmit={enviarFormulario} noValidate>
                <CampoFormulario
                  id="nome"
                  label="Nome do estabelecimento"
                  placeholder="Ex.: Padaria do Carlos"
                  autoComplete="organization"
                  maxLength={150}
                  value={dados.nome}
                  onChange={alterarCampo}
                  onBlur={validarAoSair}
                  erro={erros.nome}
                  disabled={enviando}
                />
                <CampoFormulario
                  id="cnpj"
                  label="CNPJ"
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  value={dados.cnpj}
                  onChange={alterarCampo}
                  onBlur={validarAoSair}
                  erro={erros.cnpj}
                  dica="Aceita CNPJ numérico ou alfanumérico."
                  disabled={enviando}
                />
                <CampoFormulario
                  id="endereco"
                  label="Endereço completo"
                  placeholder="Rua, número, bairro, cidade e UF"
                  autoComplete="street-address"
                  maxLength={250}
                  value={dados.endereco}
                  onChange={alterarCampo}
                  onBlur={validarAoSair}
                  erro={erros.endereco}
                  disabled={enviando}
                />
                <CampoFormulario
                  id="contato"
                  label="Telefone ou e-mail para contato"
                  placeholder="(82) 99999-9999 ou contato@empresa.com"
                  maxLength={120}
                  value={dados.contato}
                  onChange={alterarCampo}
                  onBlur={validarAoSair}
                  erro={erros.contato}
                  disabled={enviando}
                />

                {erroGeral && (
                  <p className="cadastro-erro-geral" role="alert">{erroGeral}</p>
                )}

                <button className="botao-principal" type="submit" disabled={enviando}>
                  {enviando ? "Enviando cadastro..." : "Enviar para aprovação →"}
                </button>
                <p className="cadastro-rodape">
                  Após o envio, o cadastro será analisado antes da liberação de doações.
                </p>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
