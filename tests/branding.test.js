import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as publicController from '../controllers/public.controller.js';
import * as settings from '../services/settings.service.js';

test('branding colors accept only six-digit hexadecimal values', () => {
  const primary = settings.fields.primary_color[1];
  const secondary = settings.fields.secondary_color[1];

  assert.equal(primary.safeParse('#123abc').success, true);
  assert.equal(secondary.safeParse('#F5C84B').success, true);
  assert.equal(primary.safeParse('red').success, false);
  assert.equal(primary.safeParse('#fff').success, false);
  assert.equal(primary.safeParse('#123456;body{display:none}').success, false);
});

test('branding defaults preserve the COSOREMI palette', () => {
  assert.equal(settings.defaults.primary_color, '#0f5f46');
  assert.equal(settings.defaults.secondary_color, '#f5c84b');
  assert.equal(settings.defaults.site_logo, '');
});

test('theme stylesheet sanitizes stored color values before rendering', () => {
  const response = {
    locals: {
      settings: {
        primary_color: '#123456;body{display:none}',
        secondary_color: '#abcdef',
      },
    },
    headers: {},
    type(value) {
      this.contentType = value;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
  };

  publicController.theme({}, response);

  assert.equal(response.contentType, 'text/css');
  assert.equal(response.headers['Cache-Control'], 'public, max-age=300');
  assert.match(response.body, /--primary-color: #0f5f46;/);
  assert.match(response.body, /--secondary-color: #abcdef;/);
  assert.doesNotMatch(response.body, /display:none/);
});
