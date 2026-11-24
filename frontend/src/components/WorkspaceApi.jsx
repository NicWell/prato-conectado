import { useEffect, useState } from 'react';
import { catalogoDoacoesApi, listarDoacoesApi, publicarDoacaoApi, atualizarDoacaoApi } from '../services/doacoes.js';
import { desativarNecessidade, listarNecessidades, salvarNecessidade } from '../services/necessidades.js';
import { cadastrarVoluntario, listarVoluntarios } from '../services/voluntarios.js';
import Workspace from './Workspace.jsx';

export default function WorkspaceApi(props) {
  const { rota, navegar } = props;
  const novaDoacao = rota === '/app/nova-doacao' && props.usuario.tipo === 'DOADOR';
  const paginaNecessidades = rota === '/app/necessidades' && props.usuario.tipo === 'ONG';
  const paginaVoluntarios = rota === '/app/voluntarios' && props.usuario.tipo === 'ONG';
  const [consulta, setConsulta] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    let ativo = true;
    const buscar = {
      '/app/voluntarios': paginaVoluntarios ? listarVoluntarios : listarDoacoesApi,
      '/app/necessidades': paginaNecessidades ? listarNecessidades : listarDoacoesApi,
      '/app/nova-doacao': novaDoacao ? catalogoDoacoesApi : listarDoacoesApi,
    }[rota] ?? listarDoacoesApi;
    buscar().then(resultado => {
      if (ativo) setResultado(resultado);
    }).catch(falha => {
      if (ativo) setErro(falha.message);
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => { ativo = false; };
  }, [novaDoacao, paginaNecessidades, paginaVoluntarios, rota, consulta]);

  function recarregar() {
    setCarregando(true);
    setConsulta(valor => valor + 1);
  }

  async function atualizar(id, acao, checklist) {
    setProcessando(true);
    setErro('');
    try {
      await atualizarDoacaoApi(id, acao, checklist);
      if (acao === 'RESERVAR') navegar('/app/reservas');
      else recarregar();
    } catch (falha) {
      setErro(falha.message);
      if (falha.status === 409) recarregar();
    } finally {
      setProcessando(false);
    }
  }

  return <Workspace
    {...props}
    doacoes={!paginaVoluntarios && Array.isArray(resultado) ? resultado : []}
    voluntarios={paginaVoluntarios ? resultado : null}
    cadastrarVoluntario={async dados => {
      await cadastrarVoluntario(dados);
      recarregar();
    }}
    necessidades={paginaNecessidades ? resultado : null}
    salvarNecessidade={async (id, dados) => {
      await salvarNecessidade(id, dados);
      recarregar();
    }}
    desativarNecessidade={async id => {
      await desativarNecessidade(id);
      recarregar();
    }}
    catalogo={novaDoacao ? resultado : null}
    publicar={form => publicarDoacaoApi(form, resultado.termo.id)}
    atualizar={atualizar}
    processando={processando}
    carregando={carregando}
    erro={erro}
    recarregar={() => { setErro(''); recarregar(); }}
  />;
}
