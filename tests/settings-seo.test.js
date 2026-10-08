import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import ejs from 'ejs';
import express from 'express';
import sharp from 'sharp';
import request from 'supertest';
import * as settingsController from '../controllers/settings.controller.js';
import upload from '../middleware/upload.middleware.js';
import * as settings from '../services/settings.service.js';
import * as uploads from '../services/upload.service.js';

const settingsTemplate = path.join(
  import.meta.dirname,
  '..',
  'views',
  'admin',
  'settings.ejs'
);
const csrf = 'a'.repeat(64);

function validBody(overrides = {}) {
  return {
    site_name: 'COSOREMI',
    site_description: 'Descrição institucional',
    primary_color: '#0f5f46',
    secondary_color: '#f5c84b',
    phone: '',
    whatsapp: '',
    emergency_phone: '',
    institutional_email: '',
    address: '',
    office_hours: '',
    facebook: '',
    instagram: '',
    youtube: '',
    donation_text: '',
    donation_pix: '',
    emergency_text: '',
    help_cta: 'Preciso de ajuda',
    donate_cta: 'Quero ajudar',
    blog_seo_title: '',
    blog_seo_description: '',
    work_areas_seo_title: '',
    work_areas_seo_description: '',
    gallery_seo_title: '',
    gallery_seo_description: '',
    ...overrides,
  };
}

async function imageFile(fieldname) {
  return {
    fieldname,
    originalname: `${fieldname}.png`,
    mimetype: 'image/png',
    buffer: await sharp({
      create: { width: 20, height: 12, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer(),
  };
}

function diskPath(publicPath) {
  return path.join(import.meta.dirname, '..', 'public', publicPath.slice(1));
}

function mockDb(current = {}, { fail = false } = {}) {
  const written = new Map();
  const tx = {
    setting: {
      upsert: async ({ where, create, update }) => {
        written.set(where.key, create.value ?? update.value);
      },
    },
    auditLog: { create: async () => ({}) },
  };
  return {
    written,
    setting: {
      findMany: async () =>
        Object.entries({ ...validBody(), ...current }).map(([key, value]) => ({
          key,
          value,
        })),
    },
    $transaction: async (callback) => {
      await callback(tx);
      if (fail) throw new Error('transaction failed');
    },
  };
}

async function saveSettings({ current, files = {}, body = {}, fail = false }) {
  const db = mockDb(current, { fail });
  const response = {};
  await settingsController.save(
    {
      body: validBody(body),
      files,
      user: { id: 'admin-1' },
      app: { locals: { db } },
    },
    {
      redirect(location) {
        response.location = location;
      },
    }
  );
  return { db, response };
}

test('listing SEO settings accept trimmed plain text and enforce limits', () => {
  const keys = [
    'blog_seo_title',
    'blog_seo_description',
    'work_areas_seo_title',
    'work_areas_seo_description',
    'gallery_seo_title',
    'gallery_seo_description',
  ];
  const input = Object.fromEntries(
    keys.map((key) => [key, `  <b>${key}</b>  `])
  );
  const result = settings.validate(validBody(input));
  for (const key of keys) {
    assert.equal(result[key], `<b>${key}</b>`);
    assert.equal(settings.validate(validBody({ [key]: '' }))[key], '');
  }
  for (const key of keys.filter((key) => key.endsWith('_title')))
    assert.throws(() =>
      settings.validate(validBody({ [key]: 'x'.repeat(181) }))
    );
  for (const key of keys.filter((key) => key.endsWith('_description')))
    assert.throws(() =>
      settings.validate(validBody({ [key]: 'x'.repeat(321) }))
    );
});

test('settings form groups editorial SEO and preserves secure image controls', async () => {
  const html = await ejs.renderFile(settingsTemplate, {
    fields: settings.fields,
    seoFieldKeys: settings.seoFieldKeys,
    values: {
      ...settings.defaults,
      ...validBody(),
      site_logo: '/uploads/branding/logo.webp',
      default_social_image: '/uploads/branding/social.webp',
    },
    csrf,
    user: { name: 'Admin', role: 'SUPER_ADMIN' },
  });
  assert.match(html, /SEO e compartilhamento/);
  for (const key of settings.seoFieldKeys) {
    assert.equal(
      (html.match(new RegExp(`name="${key}"`, 'g')) || []).length,
      1
    );
    assert.match(
      html,
      new RegExp(
        `id="${key}"[^>]*maxlength="${key.endsWith('_title') ? 180 : 320}"`,
        's'
      )
    );
  }
  assert.match(
    html,
    /name="logo"[^>]*accept="image\/jpeg,image\/png,image\/webp"/s
  );
  assert.match(html, /name="removeLogo"/);
  assert.match(
    html,
    /name="socialImage"[^>]*accept="image\/jpeg,image\/png,image\/webp"/s
  );
  assert.match(html, /name="removeSocialImage"/);
  assert.match(html, /alt="Logo atual do site"/);
  assert.match(html, /alt="Imagem padrão atual de compartilhamento"/);
  assert.match(html, /1200 × 630 px/);
});

test('settings upload handler accepts only one logo and one social image', async () => {
  const png = (await imageFile('image')).buffer;
  const app = express();
  app.post('/', upload.settings, (req, res) =>
    res.json({
      logo: req.files.logo?.length || 0,
      socialImage: req.files.socialImage?.length || 0,
    })
  );
  app.use((error, req, res, next) =>
    res.status(422).json({ code: error.code || error.name })
  );

  assert.deepEqual(
    (
      await request(app)
        .post('/')
        .attach('logo', png, { filename: 'logo.png', contentType: 'image/png' })
        .expect(200)
    ).body,
    { logo: 1, socialImage: 0 }
  );
  assert.deepEqual(
    (
      await request(app)
        .post('/')
        .attach('socialImage', png, {
          filename: 'social.png',
          contentType: 'image/png',
        })
        .expect(200)
    ).body,
    { logo: 0, socialImage: 1 }
  );
  await request(app)
    .post('/')
    .attach('logo', png, { filename: 'logo.png', contentType: 'image/png' })
    .attach('socialImage', png, {
      filename: 'social.png',
      contentType: 'image/png',
    })
    .expect(200);
  await request(app)
    .post('/')
    .attach('unexpected', png, {
      filename: 'bad.png',
      contentType: 'image/png',
    })
    .expect(422);
  await request(app)
    .post('/')
    .attach('logo', png, { filename: 'one.png', contentType: 'image/png' })
    .attach('logo', png, { filename: 'two.png', contentType: 'image/png' })
    .expect(422);
});

test('logo and social image changes are independent', async () => {
  const logo = await imageFile('logo');
  const socialImage = await imageFile('socialImage');
  const scenarios = [
    { files: { logo: [logo] }, expectLogo: /^\/uploads\/branding\// },
    {
      files: { socialImage: [socialImage] },
      expectSocial: /^\/uploads\/branding\//,
    },
    {
      files: { logo: [logo], socialImage: [socialImage] },
      expectLogo: /^\/uploads\/branding\//,
      expectSocial: /^\/uploads\/branding\//,
    },
    {
      current: {
        site_logo: '/uploads/branding/old-logo.webp',
        default_social_image: '/uploads/branding/kept-social.webp',
      },
      files: { logo: [logo] },
      expectLogo: /^\/uploads\/branding\//,
      expectSocial: '/uploads/branding/kept-social.webp',
    },
    {
      current: {
        site_logo: '/uploads/branding/kept-logo.webp',
        default_social_image: '/uploads/branding/old-social.webp',
      },
      files: { socialImage: [socialImage] },
      expectLogo: '/uploads/branding/kept-logo.webp',
      expectSocial: /^\/uploads\/branding\//,
    },
    {
      current: {
        site_logo: '/uploads/branding/old-logo.webp',
        default_social_image: '/uploads/branding/kept-social.webp',
      },
      body: { removeLogo: 'on' },
      expectLogo: '',
      expectSocial: '/uploads/branding/kept-social.webp',
    },
    {
      current: {
        site_logo: '/uploads/branding/kept-logo.webp',
        default_social_image: '/uploads/branding/old-social.webp',
      },
      body: { removeSocialImage: 'on' },
      expectLogo: '/uploads/branding/kept-logo.webp',
      expectSocial: '',
    },
    {
      current: {
        site_logo: '/uploads/branding/old-logo.webp',
        default_social_image: '/uploads/branding/old-social.webp',
      },
      files: { logo: [logo], socialImage: [socialImage] },
      expectLogo: /^\/uploads\/branding\//,
      expectSocial: /^\/uploads\/branding\//,
    },
  ];

  for (const scenario of scenarios) {
    const { db, response } = await saveSettings(scenario);
    const persisted = {
      ...scenario.current,
      ...Object.fromEntries(db.written),
    };
    assert.equal(response.location, '/admin/settings');
    if (scenario.expectLogo instanceof RegExp) {
      assert.match(persisted.site_logo, scenario.expectLogo);
      await uploads.remove(persisted.site_logo);
    } else if (scenario.expectLogo !== undefined)
      assert.equal(persisted.site_logo, scenario.expectLogo);
    if (scenario.expectSocial instanceof RegExp) {
      assert.match(persisted.default_social_image, scenario.expectSocial);
      await uploads.remove(persisted.default_social_image);
    } else if (scenario.expectSocial !== undefined)
      assert.equal(persisted.default_social_image, scenario.expectSocial);
  }
});

test('successful replacement removes old files only after persistence', async () => {
  const oldLogo = await uploads.save(await imageFile('logo'), 'branding');
  const oldSocial = await uploads.save(
    await imageFile('socialImage'),
    'branding'
  );
  const { db } = await saveSettings({
    current: { site_logo: oldLogo, default_social_image: oldSocial },
    files: {
      logo: [await imageFile('logo')],
      socialImage: [await imageFile('socialImage')],
    },
  });
  await assert.rejects(fs.access(diskPath(oldLogo)));
  await assert.rejects(fs.access(diskPath(oldSocial)));
  await fs.access(diskPath(db.written.get('site_logo')));
  await fs.access(diskPath(db.written.get('default_social_image')));
  await Promise.all([
    uploads.remove(db.written.get('site_logo')),
    uploads.remove(db.written.get('default_social_image')),
  ]);
});

test('transaction failure cleans every new file and preserves old files', async () => {
  const oldLogo = await uploads.save(await imageFile('logo'), 'branding');
  const oldSocial = await uploads.save(
    await imageFile('socialImage'),
    'branding'
  );
  const db = mockDb(
    { site_logo: oldLogo, default_social_image: oldSocial },
    { fail: true }
  );
  await assert.rejects(
    settingsController.save(
      {
        body: validBody(),
        files: {
          logo: [await imageFile('logo')],
          socialImage: [await imageFile('socialImage')],
        },
        user: { id: 'admin-1' },
        app: { locals: { db } },
      },
      { redirect: assert.fail }
    ),
    /transaction failed/
  );
  await fs.access(diskPath(oldLogo));
  await fs.access(diskPath(oldSocial));
  await assert.rejects(fs.access(diskPath(db.written.get('site_logo'))));
  await assert.rejects(
    fs.access(diskPath(db.written.get('default_social_image')))
  );
  await Promise.all([uploads.remove(oldLogo), uploads.remove(oldSocial)]);
});

test('settings social image remains on the Sharp validation path', async () => {
  const db = mockDb();
  await assert.rejects(
    settingsController.save(
      {
        body: validBody(),
        files: {
          socialImage: [
            {
              originalname: 'unsafe.svg',
              mimetype: 'image/svg+xml',
              buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
            },
          ],
        },
        user: { id: 'admin-1' },
        app: { locals: { db } },
      },
      { redirect: assert.fail }
    ),
    { status: 422 }
  );
});

test('a second image processing failure cleans the first new upload', async () => {
  const brandingDirectory = path.join(
    import.meta.dirname,
    '..',
    'public',
    'uploads',
    'branding'
  );
  const before = new Set(await fs.readdir(brandingDirectory).catch(() => []));
  const db = mockDb();
  await assert.rejects(
    settingsController.save(
      {
        body: validBody(),
        files: {
          logo: [await imageFile('logo')],
          socialImage: [
            {
              originalname: 'unsafe.svg',
              mimetype: 'image/svg+xml',
              buffer: Buffer.from('<svg></svg>'),
            },
          ],
        },
        user: { id: 'admin-1' },
        app: { locals: { db } },
      },
      { redirect: assert.fail }
    ),
    { status: 422 }
  );
  const after = new Set(await fs.readdir(brandingDirectory).catch(() => []));
  assert.deepEqual(after, before);
});
