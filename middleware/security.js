const crypto = require('node:crypto');
const { httpError } = require('../utils/http');
exports.token = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  req.session.csrf ||= crypto.randomBytes(32).toString('hex');
  res.locals.csrf = req.session.csrf;
  next();
};
exports.csrf = (req, res, next) => {
  const submitted = req.body?._csrf || req.get('x-csrf-token');
  const expected = req.session.csrf;
  if (
    typeof submitted !== 'string' ||
    !expected ||
    Buffer.byteLength(submitted) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(expected))
  ) {
    return next(
      httpError(
        403,
        'Formulário expirado ou inválido. Atualize a página e tente novamente.'
      )
    );
  }
  res.locals.csrf = req.session.csrf;
  next();
};
