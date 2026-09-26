import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import ejs from 'ejs';
import * as contentController from '../controllers/content.controller.js';
import { resources } from '../services/content.service.js';

const template = path.join(
  import.meta.dirname,
  '..',
  'views',
  'admin',
  'form.ejs'
);
const user = { name: 'Test administrator', role: 'SUPER_ADMIN' };
const csrf = 'a'.repeat(64);

const fixtures = {
  pages: { id: 'page-1', title: '<Página>', heroImage: '/page.webp' },
  posts: {
    id: 'post-1',
    title: 'Publicação',
    featuredImage: '/post.webp',
    publishedAt: new Date('2026-09-26T12:30:00Z'),
  },
  categories: { id: 'category-1', name: 'Categoria' },
  'work-areas': { id: 'area-1', title: 'Atuação', image: '/area.webp' },
  gallery: {
    id: 'gallery-1',
    title: 'Atividade',
    image: '/gallery.webp',
    activityDate: new Date('2026-09-26T00:00:00Z'),
  },
};

const expectedFields = {
  pages: [
    '_csrf',
    'title',
    'slug',
    'subtitle',
    'content',
    'contentBlocks',
    'published',
    'image',
    'seoTitle',
    'seoDescription',
  ],
  posts: [
    '_csrf',
    'title',
    'slug',
    'summary',
    'content',
    'contentBlocks',
    'status',
    'categoryId',
    'publishedAt',
    'image',
    'seoTitle',
    'seoDescription',
  ],
  categories: ['_csrf', 'name', 'slug'],
  'work-areas': [
    '_csrf',
    'title',
    'slug',
    'summary',
    'content',
    'contentBlocks',
    'displayOrder',
    'active',
    'image',
    'seoTitle',
    'seoDescription',
  ],
  gallery: [
    '_csrf',
    'title',
    'description',
    'category',
    'activityDate',
    'published',
    'image',
  ],
};

const names = (html) => {
  const form = html.match(
    /<form method="post" enctype="multipart\/form-data"[^>]*>([\s\S]*?)<\/form>/
  );
  assert.ok(form, 'CMS form not rendered');
  return [
    ...form[1].matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g),
  ]
    .map((match) => match[1])
    .filter((name) => name !== 'removeImage');
};

const render = (resource, item = {}) =>
  ejs.renderFile(template, {
    resource,
    spec: resources[resource],
    fields: resources[resource].fields,
    item,
    categories: [{ id: 'category-1', name: 'Categoria' }],
    csrf,
    cspNonce: 'editor-style-nonce',
    user,
  });

test('admin resource forms preserve fields for create and edit', async () => {
  for (const resource of Object.keys(resources)) {
    for (const item of [{}, fixtures[resource]]) {
      const html = await render(resource, item);
      assert.deepEqual(names(html), expectedFields[resource]);
      assert.match(html, new RegExp(`name="_csrf" value="${csrf}"`));
      for (const field of resources[resource].fields) {
        const control = html.match(
          new RegExp(`<(?:input|textarea)\\b[^>]*id="${field.name}"[^>]*>`, 's')
        );
        assert.ok(control, `${resource}.${field.name} control not rendered`);
        assert.match(control[0], new RegExp(`maxlength="${field.maxLength}"`));
        assert.equal(/\brequired\b/.test(control[0]), Boolean(field.required));
        if (['textarea', 'rich-content'].includes(field.type))
          assert.match(control[0], new RegExp(`rows="${field.rows}"`));
        assert.ok(
          html.includes(`for="${field.name}"`) &&
            html.includes(`>${field.label}</label>`),
          `${resource}.${field.name} label not rendered`
        );
      }
    }
  }
});

test('admin form instructions describe their controls', async () => {
  const post = await render('posts', fixtures.posts);
  assert.match(post, /id="content"[^>]*aria-describedby="rich-content-help"/s);
  assert.match(post, /id="rich-content-help"/);
  assert.match(post, /data-editor-holder[^>]*aria-labelledby="content-label"/s);
  assert.match(post, /data-editor-style-nonce="editor-style-nonce"/);
  assert.match(post, /name="contentBlocks"[^>]*disabled/s);
  assert.match(
    post,
    /id="publishedAt"[^>]*aria-describedby="published-at-help"/s
  );
  assert.match(post, /id="published-at-help"/);
  assert.match(post, /id="image"[^>]*aria-describedby="image-help"/s);
  assert.match(post, /id="image-help"/);

  const category = await render('categories', fixtures.categories);
  assert.doesNotMatch(category, /plain-text-help/);
});

test('admin forms preserve required fields and upload behavior', async () => {
  const post = await render('posts');
  assert.match(post, /id="content"[^>]*required/s);
  assert.match(
    post,
    /name="image"[^>]*accept="image\/jpeg,image\/png,image\/webp"/s
  );
  assert.doesNotMatch(post, /name="image"[^>]*required/s);

  const page = await render('pages');
  assert.doesNotMatch(page, /id="content"[^>]*required/s);

  const gallery = await render('gallery');
  assert.match(gallery, /name="image"[^>]*required/s);
  const editedGallery = await render('gallery', fixtures.gallery);
  assert.doesNotMatch(editedGallery, /name="image"[^>]*required/s);

  for (const resource of ['pages', 'posts', 'work-areas'])
    assert.match(
      await render(resource, fixtures[resource]),
      /name="removeImage"/
    );
  assert.doesNotMatch(editedGallery, /name="removeImage"/);
});

test('only primary long-form fields use the progressive rich editor', async () => {
  for (const resource of ['pages', 'posts', 'work-areas']) {
    const html = await render(resource, fixtures[resource]);
    assert.match(html, /data-rich-content-field/);
    assert.equal(
      resources[resource].fields.find((field) => field.name === 'content').type,
      'rich-content'
    );
  }
  for (const resource of ['categories', 'gallery'])
    assert.doesNotMatch(
      await render(resource, fixtures[resource]),
      /data-rich-content-field/
    );
  assert.equal(
    resources.posts.fields.find((field) => field.name === 'summary').type,
    'textarea'
  );
});

test('existing upload preview uses contextual escaped alternative text', async () => {
  const html = await render('pages', fixtures.pages);
  assert.match(html, /alt="Imagem atual de &lt;Página&gt;"/);
  assert.doesNotMatch(html, /alt="Imagem atual"/);
});

test('content controller passes resource field metadata to the view', async () => {
  let rendered;
  await contentController.form(
    {
      params: {},
      resource: 'pages',
      spec: resources.pages,
      app: { locals: { db: {} } },
    },
    {
      render(view, locals) {
        rendered = { view, locals };
      },
    }
  );

  assert.equal(rendered.view, 'admin/form');
  assert.equal(rendered.locals.fields, resources.pages.fields);
});
