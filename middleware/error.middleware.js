module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message =
    status < 500
      ? error.message
      : 'Não foi possível concluir a operação. Tente novamente mais tarde.';
  if (error.code === 'P2002') {
    status = 409;
    message = 'Já existe um registro com esse endereço (slug) ou e-mail.';
  }
  if (error.code === 'P2025') {
    status = 404;
    message = 'Registro não encontrado.';
  }
  if (error.code === 'P2003') {
    status = 422;
    message = 'O registro relacionado não está disponível.';
  }
  if (error.name === 'MulterError') {
    status = 422;
    message = 'Upload inválido. Envie uma imagem de até 5 MB.';
  }
  if (status >= 500)
    console.error(
      JSON.stringify({ event: 'request_error', code: error.code || error.name })
    );
  res.status(status).render('error', { status, message });
};
