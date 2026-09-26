import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ejs from 'ejs';
import { roles } from '../middleware/auth.middleware.js';
import { csrf } from '../middleware/security.js';
import { published } from '../services/content.service.js';
import * as settings from '../services/settings.service.js';
import * as userService from '../services/user.service.js';
import slug from '../utils/slug.js';
import { contact, password, schemas } from '../validators/content.js';
test('contact rejects invalid, overlong and unexpected subject fields', () => {
  const valid = {
    name: 'Maria Silva',
    email: 'maria@example.org',
    subject: 'Outro',
    message: 'Gostaria de conhecer o trabalho.',
  };
  assert.equal(contact.safeParse(valid).success, true);
  for (const change of [
    { email: 'bad' },
    { name: '' },
    { subject: 'internal' },
    { message: 'x'.repeat(5001) },
  ])
    assert.equal(contact.safeParse({ ...valid, ...change }).success, false);
  assert.equal(contact.parse({ ...valid, read: true }).read, undefined);
});
test('role checks reject editors on privileged routes', () => {
  let error;
  roles('SUPER_ADMIN', 'ADMIN')(
    { user: { role: 'EDITOR' } },
    { locals: {} },
    (e) => {
      error = e;
    }
  );
  assert.equal(error.status, 403);
  roles('SUPER_ADMIN')(
    { user: { role: 'SUPER_ADMIN' } },
    { locals: {} },
    (e) => {
      error = e;
    }
  );
  assert.equal(error, undefined);
});
test('CSRF rejects missing and forged tokens', () => {
  for (const value of [undefined, 'wrong', 'b'.repeat(64)]) {
    let error;
    csrf(
      {
        body: { _csrf: value },
        get: () => undefined,
        session: { csrf: 'a'.repeat(64) },
      },
      { locals: {} },
      (e) => {
        error = e;
      }
    );
    assert.equal(error.status, 403);
  }
  let error;
  csrf(
    { body: { _csrf: 'a'.repeat(64) }, session: { csrf: 'a'.repeat(64) } },
    { locals: {} },
    (e) => {
      error = e;
    }
  );
  assert.equal(error, undefined);
});
test('slugs normalize accents and remove unsafe characters', () => {
  assert.equal(slug('Proteção e Educação!'), 'protecao-e-educacao');
  assert.equal(
    schemas.categories.safeParse({ name: 'Test', slug: '!!!' }).success,
    false
  );
});
test('public post predicate includes publication status and time boundary', () => {
  const where = published();
  assert.equal(where.status, 'PUBLISHED');
  assert.ok(where.publishedAt.lte instanceof Date);
});
test('password policy enforces bcrypt byte limit', () => {
  assert.equal(password.safeParse('short').success, false);
  assert.equal(password.safeParse('á'.repeat(40)).success, false);
  assert.equal(password.safeParse('long-enough-password').success, true);
});
test('social settings reject script and insecure URL schemes', () => {
  const schema = settings.fields.instagram[1];
  assert.equal(schema.safeParse('javascript:alert(1)').success, false);
  assert.equal(
    schema.safeParse('https://instagram.com/cosoremi').success,
    true
  );
});
test('the last active SUPER_ADMIN cannot be deactivated or demoted', async () => {
  let locked = false;
  let changed = false;
  const tx = {
    $executeRaw: async () => {
      locked = true;
    },
    user: {
      findUniqueOrThrow: async () => ({
        id: 'last',
        active: true,
        role: 'SUPER_ADMIN',
      }),
      count: async () => {
        assert.ok(locked);
        return 1;
      },
      update: async () => {
        changed = true;
      },
    },
  };
  const db = { $transaction: (fn) => fn(tx) };
  for (const data of [
    { active: false, role: 'SUPER_ADMIN' },
    { active: true, role: 'ADMIN' },
  ]) {
    await assert.rejects(
      userService.save(db, 'last', { ...data, password: '' }, 'last'),
      { status: 422 }
    );
  }
  assert.equal(changed, false);
});
test('all EJS templates compile', () => {
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filename);
      else if (filename.endsWith('.ejs'))
        assert.doesNotThrow(() =>
          ejs.compile(fs.readFileSync(filename, 'utf8'), { filename })
        );
    }
  }
  walk(path.join(import.meta.dirname, '..', 'views'));
});
