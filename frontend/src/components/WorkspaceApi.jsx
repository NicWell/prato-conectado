import { useEffect, useState } from 'react';
import { catalogoDoacoesApi, listarDoacoesApi, publicarDoacaoApi, reservarDoacaoApi } from '../services/doacoes.js';
import Workspace from './Workspace.jsx';

export default function WorkspaceApi(props) {
  const { rota, navegar } = props;
  const novaDoacao = rota === '/app/nova-doacao' && props.usuario.tipo === 'DOADOR';
  const [consulta, setConsulta] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [reservando, setReservando] = useState(false);

  useEffect(() => {
    let ativo = true;
    const buscar = novaDoacao ? catalogoDoacoesApi : listarDoacoesApi;
    buscar().then(resultado => {
      if (ativo) setResultado(resultado);
    }).catch(falha => {
      if (ativo) setErro(falha.message);
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => { ativo = false; };
  }, [novaDoacao, rota, consulta]);

  function recarregar() {
    setCarregando(true);
    setConsulta(valor => valor + 1);
  }

  async function reservar(id) {
    setReservando(true);
    setErro('');
    try {
      await reservarDoacaoApi(id);
      navegar('/app/reservas');
    } catch (falha) {
      setErro(falha.message);
      if (falha.status === 409) recarregar();
    } finally {
      setReservando(false);
    }
  }

  return <Workspace
    {...props}
    apiAtiva
    doacoes={!novaDoacao && resultado ? resultado : []}
    catalogo={novaDoacao ? resultado : null}
    publicar={form => publicarDoacaoApi(form, resultado.termo.id)}
    atualizar={reservar}
    reservando={reservando}
    carregando={carregando}
    erro={erro}
    recarregar={() => { setErro(''); recarregar(); }}
  />;
}
