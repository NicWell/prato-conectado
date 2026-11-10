export function perfilIncompleto(usuario) {
  return usuario?.cadastro_completo === false || usuario?.tipo === 'SEM_ORGANIZACAO';
}

export function destino(usuario) {
  if (usuario?.papel_sistema === 'ADMINISTRADOR') return '/admin/cadastros';
  if (perfilIncompleto(usuario)) return '/concluir-cadastro';
  if (usuario?.status === 'PENDENTE') return '/pendente';
  if (usuario?.status === 'REPROVADA' || usuario?.status === 'REPROVADO') return '/reprovado';
  return '/app/inicio';
}
