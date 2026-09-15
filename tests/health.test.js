const { test } = require('node:test');
const assert = require('node:assert/strict');
const { health } = require('../controllers/health.controller');

async function check(db) {
  const response = { headers: {} };
  const res = {
    set: (name, value) => {
      response.headers[name] = value;
    },
    status: (code) => {
      response.status = code;
      return res;
    },
    json: (body) => {
      response.body = body;
    },
  };
  await health({ app: { locals: { db } } }, res);
  return response;
}

test('readiness checks PostgreSQL and returns a minimal uncached response', async () => {
  let queried = false;
  const response = await check({
    $queryRaw: async () => {
      queried = true;
    },
  });
  assert.equal(queried, true);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('readiness returns 503 without leaking database errors', async () => {
  const response = await check({
    $queryRaw: async () => {
      throw new Error('private connection details');
    },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { status: 'unavailable' });
});
