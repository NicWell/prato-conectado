import { requisicaoApi } from './auth.js';
import { dataLocal } from '../utils/formularios.js';

const caminho = '/api/doacoes';

export function catalogoDoacoesApi() {
  return requisicaoApi(`${caminho}/catalogo`, { autenticada: true });
}

export async function listarDoacoesApi() {
  const ofertas = await requisicaoApi(caminho, { autenticada: true });
  return ofertas.map(oferta => {
    const inicio = new Date(oferta.inicio_retirada);
    const fim = new Date(oferta.fim_retirada);
    const hora = data => data.toTimeString().slice(0, 5);
    return {
      ...oferta,
      validade: dataLocal(new Date(new Date(oferta.validade_em).getTime() - 1)),
      retiradaData: dataLocal(inicio),
      retiradaInicio: hora(inicio),
      retiradaFim: hora(fim),
    };
  });
}

export function publicarDoacaoApi(form, termoId) {
  const validade = new Date(`${form.validade}T00:00:00`);
  validade.setDate(validade.getDate() + 1);
  return requisicaoApi(caminho, {
    method: 'POST',
    autenticada: true,
    payload: {
      categoria: form.categoria,
      descricao: form.descricao,
      quantidade: form.quantidade,
      unidade: form.unidade,
      modalidade: form.entrega,
      validade_em: validade.toISOString(),
      inicio_retirada: new Date(`${form.retiradaData}T${form.retiradaInicio}`).toISOString(),
      fim_retirada: new Date(`${form.retiradaData}T${form.retiradaFim}`).toISOString(),
      termo_id: termoId,
      checklist: form.checklist,
    },
  });
}

const operacoes = {
  RESERVAR: 'reserva',
  CANCELAR: 'cancelamento',
  RETIRAR: 'retirada',
  RECEBER: 'recebimento',
};

export function atualizarDoacaoApi(id, acao, checklist) {
  return requisicaoApi(`${caminho}/${encodeURIComponent(id)}/${operacoes[acao]}`, {
    method: 'POST', autenticada: true, payload: checklist,
  });
}
