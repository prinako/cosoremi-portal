const environment = require('./config/env');
const createApp = require('./app');
const db = require('./config/database');
async function start() {
  const env = environment();
  await db.$connect();
  const app = createApp({ db, env });
  const server = app.listen(Number(process.env.PORT) || 3000, () =>
    console.info('COSOREMI Portal iniciado.')
  );
  const shutdown = () => {
    server.close(async () => {
      await db.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
start().catch(() => {
  console.error(
    'Não foi possível iniciar o COSOREMI Portal. Verifique a configuração e o banco de dados.'
  );
  process.exit(1);
});
