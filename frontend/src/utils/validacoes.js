/** Retorna o CNPJ sem pontuação, preservando letras do novo formato. */
export function limparCnpj(valor = "") {
  return String(valor).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

/** Aplica máscara tanto a CNPJs numéricos quanto alfanuméricos. */
export function formatarCnpj(valor) {
  const cnpj = limparCnpj(valor);
  if (cnpj.length <= 2) return cnpj;
  if (cnpj.length <= 5) return `${cnpj.slice(0, 2)}.${cnpj.slice(2)}`;
  if (cnpj.length <= 8) return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5)}`;
  if (cnpj.length <= 12) {
    return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8)}`;
  }
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

/**
 * Calcula o dígito verificador (módulo 11).
 * Para letras, usa o código ASCII menos 48, conforme o CNPJ alfanumérico.
 */
function calcularDigito(cnpjParcial, pesos) {
  const soma = [...cnpjParcial].reduce(
    (total, caractere, indice) => total + (caractere.charCodeAt(0) - 48) * pesos[indice],
    0
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(valor) {
  const cnpj = limparCnpj(valor);

  // 12 primeiras posições alfanuméricas; últimos 2 dígitos numéricos.
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const primeiro = calcularDigito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcularDigito(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return Number(cnpj[12]) === primeiro && Number(cnpj[13]) === segundo;
}

/** Aceita contato por e-mail ou por telefone com DDD (com ou sem +55). */
export function contatoValido(valor) {
  const contato = String(valor ?? "").trim();
  if (!contato) return false;

  if (contato.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contato);
  }

  const digitos = contato.replace(/\D/g, "");
  const numeroNacional = digitos.startsWith("55") && [12, 13].includes(digitos.length)
    ? digitos.slice(2)
    : digitos;
  return /^[1-9]\d{9,10}$/.test(numeroNacional);
}

export function validarCadastro(dados) {
  const erros = {};

  if (!dados.nome.trim()) erros.nome = "Informe o nome do estabelecimento.";

  if (!dados.cnpj.trim()) {
    erros.cnpj = "Informe o CNPJ.";
  } else if (!cnpjValido(dados.cnpj)) {
    erros.cnpj = "Informe um CNPJ válido (numérico ou alfanumérico).";
  }

  if (!dados.endereco.trim()) erros.endereco = "Informe o endereço completo.";

  if (!dados.contato.trim()) {
    erros.contato = "Informe um telefone ou e-mail para contato.";
  } else if (!contatoValido(dados.contato)) {
    erros.contato = "Informe um telefone com DDD ou e-mail válido.";
  }

  return erros;
}
