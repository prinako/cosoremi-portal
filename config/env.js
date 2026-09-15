require('dotenv').config({ quiet: true });
function environment() {
  const { DATABASE_URL, SESSION_SECRET, APP_URL } = process.env;
  if (
    !DATABASE_URL ||
    !SESSION_SECRET ||
    SESSION_SECRET.length < 32 ||
    !APP_URL
  ) {
    throw new Error(
      'Configure DATABASE_URL, APP_URL e SESSION_SECRET (mínimo 32 caracteres).'
    );
  }
  const url = new URL(APP_URL);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('APP_URL inválida.');
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    throw new Error('Produção exige APP_URL HTTPS.');
  return {
    databaseUrl: DATABASE_URL,
    secret: SESSION_SECRET,
    appUrl: url.origin,
    production: process.env.NODE_ENV === 'production',
  };
}
module.exports = environment;
