import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as controller from '../controllers/public.controller.js';
import * as settings from '../services/settings.service.js';
import pagination from '../utils/pagination.js';

const response = () => ({
  locals: {
    appUrl: 'https://cosoremi.example',
    pageDescription: '',
    settings: { site_name: 'COSOREMI' },
  },
  render(view, data) {
    this.view = view;
    this.data = data;
  },
});

test('blog listing uses lean stable queries and a normalized canonical URL', async () => {
  let findMany;
  const db = {
    post: {
      findMany: async (query) => {
        findMany = query;
        return [];
      },
      count: async () => 13,
    },
    category: { findMany: async () => [] },
  };
  const res = response();

  await controller.list('blog')(
    {
      app: { locals: { db } },
      query: { page: '2', category: 'direitos-humanos' },
    },
    res
  );

  assert.equal(findMany.select.content, undefined);
  assert.deepEqual(findMany.orderBy, [{ publishedAt: 'desc' }, { id: 'desc' }]);
  assert.deepEqual(findMany.where.category, { slug: 'direitos-humanos' });
  assert.equal(
    res.data.currentUrl,
    'https://cosoremi.example/blog?category=direitos-humanos&page=2'
  );
});

test('gallery listing puts undated items last and rejects missing pages', async () => {
  let findMany;
  const db = {
    galleryItem: {
      findMany: async (query) => {
        findMany = query;
        return [];
      },
      count: async () => 1,
    },
  };

  await assert.rejects(
    controller.list('gallery')(
      { app: { locals: { db } }, query: { page: '2' } },
      response()
    ),
    { status: 404 }
  );
  assert.deepEqual(findMany.orderBy[0], {
    activityDate: { sort: 'desc', nulls: 'last' },
  });
});

test('public listing rejects malformed categories and unknown types', async () => {
  const req = { app: { locals: { db: {} } }, query: { category: ['one'] } };
  await assert.rejects(controller.list('blog')(req, response()), {
    status: 422,
  });
  await assert.rejects(controller.list('unknown')(req, response()), TypeError);
  await assert.rejects(
    controller.detail('unknown')(req, response()),
    TypeError
  );
});

test('pagination accepts only complete positive integers', () => {
  assert.equal(pagination('2').page, 2);
  assert.equal(pagination('2junk').page, 1);
  assert.equal(pagination(['2']).page, 1);
  assert.equal(pagination('0').page, 1);
});

test('settings reads are cached and can be invalidated', async () => {
  let reads = 0;
  const db = {
    setting: {
      findMany: async () => {
        reads += 1;
        return [{ key: 'site_name', value: `COSOREMI ${reads}` }];
      },
    },
  };

  assert.equal((await settings.read(db)).site_name, 'COSOREMI 1');
  assert.equal((await settings.read(db)).site_name, 'COSOREMI 1');
  assert.equal(reads, 1);
  settings.invalidate(db);
  assert.equal((await settings.read(db)).site_name, 'COSOREMI 2');
});
