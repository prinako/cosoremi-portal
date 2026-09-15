const { Client } = require('pg');
const { setTimeout: delay } = require('node:timers/promises');

async function waitForDatabase() {
  if (!process.env.DATABASE_URL)
    throw new Error('Missing database configuration');
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 2000,
      query_timeout: 2000,
    });
    client.on('error', () => {});
    try {
      await client.connect();
      await client.query('SELECT 1');
      return;
    } catch {
      await delay(2000);
    } finally {
      await client.end().catch(() => {});
    }
  }
  throw new Error('Database unavailable');
}

waitForDatabase().catch(() => {
  console.error(
    'PostgreSQL indisponível. Verifique a configuração e tente novamente.'
  );
  process.exitCode = 1;
});
