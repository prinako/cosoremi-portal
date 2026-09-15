const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcrypt');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const createApp = require('../../app');
const { fields } = require('../../services/settings.service');
const enabled = Boolean(process.env.TEST_DATABASE_URL);
let db, app, store, admin, editor, manager, superUser, editorUser, managerUser;
const stamp = `test-${Date.now()}`;
const pass = 'Integration-only-password-123!';
const csrf = (response) => {
  const match = response.text.match(/name="_csrf" value="([a-f0-9]+)"/);
  assert.ok(match, `CSRF token missing: ${response.status}`);
  return match[1];
};
async function login(agent, email) {
  const token = csrf(await agent.get('/admin/login').expect(200));
  return agent
    .post('/admin/login')
    .type('form')
    .send({ _csrf: token, email, password: pass })
    .expect(302);
}
async function create(agent, resource, data, file) {
  const token = csrf(await agent.get(`/admin/${resource}/new`).expect(200));
  let req = agent.post(`/admin/${resource}/new`).field('_csrf', token);
  for (const [key, value] of Object.entries(data)) req = req.field(key, value);
  if (file)
    req = req.attach('image', file, {
      filename: 'safe.png',
      contentType: 'image/png',
    });
  return req;
}
before(async () => {
  if (!enabled) return;
  db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
  store = new PgStore({
    conString: process.env.TEST_DATABASE_URL,
    tableName: 'session',
  });
  app = createApp({
    db,
    sessionStore: store,
    env: {
      databaseUrl: process.env.TEST_DATABASE_URL,
      secret: 'integration-session-secret-32-characters-long',
      appUrl: 'http://localhost:3000',
      production: false,
    },
  });
  const passwordHash = await bcrypt.hash(pass, 12);
  [superUser, editorUser, managerUser] = await Promise.all(
    ['SUPER_ADMIN', 'EDITOR', 'ADMIN'].map((role) =>
      db.user.create({
        data: {
          name: `Test ${role}`,
          email: `${stamp}-${role.toLowerCase()}@example.org`,
          passwordHash,
          role,
        },
      })
    )
  );
  admin = request.agent(app);
  editor = request.agent(app);
  manager = request.agent(app);
});
after(async () => {
  if (!enabled) return;
  await db.post.deleteMany({ where: { slug: { startsWith: stamp } } });
  await db.workArea.deleteMany({ where: { slug: { startsWith: stamp } } });
  await db.category.deleteMany({ where: { slug: { startsWith: stamp } } });
  await db.page.deleteMany({ where: { slug: { startsWith: stamp } } });
  const images = await db.galleryItem.findMany({
    where: { title: { startsWith: stamp } },
  });
  for (const item of images)
    await require('../../services/upload.service').remove(item.image);
  await db.galleryItem.deleteMany({ where: { title: { startsWith: stamp } } });
  await db.contact.deleteMany({ where: { email: `${stamp}@example.org` } });
  await db.auditLog.deleteMany({
    where: { userId: { in: [superUser.id, editorUser.id, managerUser.id] } },
  });
  await db.user.deleteMany({ where: { email: { startsWith: stamp } } });
  store.close();
  await db.$disconnect();
});
test(
  'CMS with real PostgreSQL sessions and persistence',
  { skip: !enabled },
  async (t) => {
    await t.test(
      'public routes, SEO, headers and protected routes',
      async () => {
        const ready = await request(app).get('/health').expect(200);
        assert.deepEqual(ready.body, { status: 'ok' });
        assert.equal(ready.headers['set-cookie'], undefined);
        for (const route of [
          '/',
          '/sobre-nos',
          '/linhas-de-trabalho',
          '/blog',
          '/galeria',
          '/doar',
          '/emergencia',
          '/contato',
        ]) {
          const response = await request(app).get(route).expect(200);
          assert.match(response.text, /COSOREMI/);
          assert.ok(response.headers['content-security-policy']);
          assert.doesNotMatch(
            response.text,
            /Visite Belém|hero-belem|passwordHash/
          );
        }
        const area = await db.workArea.findFirst({ where: { active: true } });
        await request(app).get(`/linhas-de-trabalho/${area.slug}`).expect(200);
        await request(app).get('/missing').expect(404);
        for (const route of [
          '/admin',
          '/admin/posts',
          '/admin/users',
          '/admin/contacts',
        ])
          await request(app)
            .get(route)
            .expect(302)
            .expect('Location', '/admin/login');
        await request(app)
          .post('/admin/posts/new')
          .send({ title: 'forged' })
          .expect(302);
      }
    );
    await t.test(
      'authentication, CSRF, cookie flags and backend role restrictions',
      async () => {
        await request(app)
          .post('/admin/login')
          .type('form')
          .send({ email: superUser.email, password: pass })
          .expect(403);
        const wrong = request.agent(app);
        const token = csrf(await wrong.get('/admin/login'));
        await wrong
          .post('/admin/login')
          .type('form')
          .send({ _csrf: token, email: superUser.email, password: 'incorrect' })
          .expect(401);
        const response = await login(admin, superUser.email);
        assert.match(response.headers['set-cookie'].join(';'), /HttpOnly/);
        assert.match(response.headers['set-cookie'].join(';'), /SameSite=Lax/);
        await login(editor, editorUser.email);
        await login(manager, managerUser.email);
        for (const route of [
          '/admin',
          '/admin/posts',
          '/admin/pages',
          '/admin/gallery',
          '/admin/settings',
          '/admin/users',
          '/admin/contacts',
          '/admin/categories',
          '/admin/work-areas',
        ])
          await admin.get(route).expect(200);
        for (const route of [
          '/admin/settings',
          '/admin/users',
          '/admin/pages',
          '/admin/work-areas',
          '/admin/contacts',
        ]) {
          await editor.get(route).expect(403);
          if (route !== '/admin/users' && route !== '/admin/contacts')
            await editor.post(route).type('form').send({}).expect(403);
        }
        await editor.post('/admin/users/new').type('form').send({}).expect(403);
        await editor
          .post('/admin/contacts/nonexistent')
          .type('form')
          .send({})
          .expect(403);
        await manager.get('/admin/users').expect(403);
        await manager
          .post('/admin/users/new')
          .type('form')
          .send({})
          .expect(403);
        await admin
          .post('/admin/settings')
          .type('form')
          .send({ site_name: 'forged' })
          .expect(403);
      }
    );
    await t.test(
      'post creation, uniqueness, editing, publication visibility and escaping',
      async () => {
        const data = {
          title: '<script>alert(1)</script>',
          slug: `${stamp}-post`,
          content: '<img src=x onerror=alert(1)>',
          status: 'DRAFT',
          publishedAt: '',
          categoryId: '',
        };
        assert.equal((await create(editor, 'posts', data)).status, 302);
        const post = await db.post.findUniqueOrThrow({
          where: { slug: data.slug },
        });
        assert.equal(post.authorId, editorUser.id);
        await request(app).get(`/blog/${post.slug}`).expect(404);
        assert.equal((await create(editor, 'posts', data)).status, 409);
        const token = csrf(
          await editor.get(`/admin/posts/${post.id}/edit`).expect(200)
        );
        const edited = await editor
          .post(`/admin/posts/${post.id}/edit`)
          .field('_csrf', token)
          .field('title', data.title)
          .field('slug', data.slug)
          .field('content', data.content)
          .field('status', 'PUBLISHED')
          .field('publishedAt', '')
          .field('categoryId', '')
          .expect(302);
        const page = await request(app).get(`/blog/${post.slug}`).expect(200);
        assert.match(page.text, /&lt;script&gt;/);
        assert.match(page.text, /&lt;img/);
        assert.doesNotMatch(page.text, /<script>alert/);
        await db.post.update({
          where: { id: post.id },
          data: { publishedAt: new Date(Date.now() + 86400000) },
        });
        await request(app).get(`/blog/${post.slug}`).expect(404);
        const scheduledList = await editor.get('/admin/posts').expect(200);
        assert.match(scheduledList.text, /Agendado para/);
        await db.post.update({
          where: { id: post.id },
          data: { status: 'ARCHIVED' },
        });
        await request(app).get(`/blog/${post.slug}`).expect(404);
      }
    );
    await t.test(
      'work areas can be created, edited, disabled and deleted',
      async () => {
        const data = {
          title: 'Test area',
          slug: `${stamp}-area`,
          content: 'Área de teste',
          summary: 'Resumo',
          displayOrder: '5',
          active: 'on',
        };
        assert.equal((await create(admin, 'work-areas', data)).status, 302);
        const item = await db.workArea.findUniqueOrThrow({
          where: { slug: data.slug },
        });
        await request(app).get(`/linhas-de-trabalho/${item.slug}`).expect(200);
        const token = csrf(
          await admin.get(`/admin/work-areas/${item.id}/edit`).expect(200)
        );
        await admin
          .post(`/admin/work-areas/${item.id}/edit`)
          .field('_csrf', token)
          .field('title', 'Edited area')
          .field('slug', item.slug)
          .field('content', 'Updated content')
          .field('displayOrder', '2')
          .expect(302);
        assert.equal(
          (await db.workArea.findUnique({ where: { id: item.id } })).title,
          'Edited area'
        );
        await request(app).get(`/linhas-de-trabalho/${item.slug}`).expect(404);
        await admin
          .post(`/admin/work-areas/${item.id}/delete`)
          .type('form')
          .send({ _csrf: token })
          .expect(302);
      }
    );
    await t.test(
      'settings updates appear immediately and unsafe URLs are rejected',
      async () => {
        const old = Object.fromEntries(
          (await db.setting.findMany()).map((s) => [s.key, s.value])
        );
        const values = Object.fromEntries(
          Object.keys(fields).map((key) => [key, old[key] || ''])
        );
        const token = csrf(await admin.get('/admin/settings').expect(200));
        try {
          await admin
            .post('/admin/settings')
            .type('form')
            .send({ ...values, phone: '+55 91 99999-0000', _csrf: token })
            .expect(302);
          assert.match((await request(app).get('/')).text, /99999-0000/);
          await admin
            .post('/admin/settings')
            .type('form')
            .send({ ...values, instagram: 'javascript:alert(1)', _csrf: token })
            .expect(422);
        } finally {
          await admin
            .post('/admin/settings')
            .type('form')
            .send({ ...values, _csrf: token })
            .expect(302);
        }
      }
    );
    await t.test(
      'validated contact is persisted and available only in the inbox',
      async () => {
        const visitor = request.agent(app);
        const token = csrf(await visitor.get('/contato'));
        const data = {
          name: 'Test contact',
          email: `${stamp}@example.org`,
          subject: 'Outro',
          message: 'Gostaria de conhecer as atividades.',
          _csrf: token,
        };
        await visitor
          .post('/contato')
          .type('form')
          .send({ ...data, email: 'bad' })
          .expect(422);
        await visitor.post('/contato').type('form').send(data).expect(303);
        const item = await db.contact.findFirstOrThrow({
          where: { email: data.email },
        });
        const page = await admin.get(`/admin/contacts/${item.id}`).expect(200);
        assert.match(page.text, /Gostaria de conhecer/);
        await editor.get(`/admin/contacts/${item.id}`).expect(403);
        await request(app).get(`/admin/contacts/${item.id}`).expect(302);
        await admin
          .post(`/admin/contacts/${item.id}`)
          .type('form')
          .send({ _csrf: csrf(page), read: 'true' })
          .expect(302);
        assert.equal(
          (await db.contact.findUnique({ where: { id: item.id } })).read,
          true
        );
      }
    );
    await t.test(
      'image validation, safe re-encoding, publication and removal',
      async () => {
        const data = {
          title: `${stamp} gallery`,
          description: 'Test image',
          category: '',
          activityDate: '',
          published: 'on',
        };
        assert.equal(
          (
            await create(
              editor,
              'gallery',
              data,
              Buffer.from('<svg onload="alert(1)"></svg>')
            )
          ).status,
          422
        );
        const image = await sharp({
          create: { width: 12, height: 12, channels: 3, background: '#fff' },
        })
          .png()
          .toBuffer();
        assert.equal(
          (await create(editor, 'gallery', data, image)).status,
          302
        );
        const item = await db.galleryItem.findFirstOrThrow({
          where: { title: data.title },
        });
        assert.match(item.image, /^\/uploads\/gallery\/[a-f0-9-]+\.webp$/);
        await request(app)
          .get(item.image)
          .expect(200)
          .expect('Content-Type', /image\/webp/);
        const token = csrf(await editor.get(`/admin/gallery/${item.id}/edit`));
        await editor
          .post(`/admin/gallery/${item.id}/delete`)
          .type('form')
          .send({ _csrf: token })
          .expect(302);
        await request(app).get(item.image).expect(404);
      }
    );
    await t.test(
      'institutional pages and categories support CRUD and publication control',
      async () => {
        const categoryData = {
          name: 'Test category',
          slug: `${stamp}-category`,
        };
        assert.equal(
          (await create(editor, 'categories', categoryData)).status,
          302
        );
        const category = await db.category.findUniqueOrThrow({
          where: { slug: categoryData.slug },
        });
        let token = csrf(
          await editor.get(`/admin/categories/${category.id}/edit`).expect(200)
        );
        await editor
          .post(`/admin/categories/${category.id}/edit`)
          .field('_csrf', token)
          .field('name', 'Edited category')
          .field('slug', category.slug)
          .expect(302);
        await editor
          .post(`/admin/categories/${category.id}/delete`)
          .type('form')
          .send({ _csrf: token })
          .expect(302);
        const pageData = {
          title: 'Institutional test',
          slug: `${stamp}-page`,
          content: 'Institutional content',
          published: 'on',
        };
        assert.equal((await create(admin, 'pages', pageData)).status, 302);
        const page = await db.page.findUniqueOrThrow({
          where: { slug: pageData.slug },
        });
        await request(app).get(`/paginas/${page.slug}`).expect(200);
        token = csrf(
          await admin.get(`/admin/pages/${page.id}/edit`).expect(200)
        );
        await admin
          .post(`/admin/pages/${page.id}/edit`)
          .field('_csrf', token)
          .field('title', 'Edited page')
          .field('slug', page.slug)
          .field('content', 'Edited content')
          .expect(302);
        await request(app).get(`/paginas/${page.slug}`).expect(404);
        await admin
          .post(`/admin/pages/${page.id}/delete`)
          .type('form')
          .send({ _csrf: token })
          .expect(302);
        const home = await db.page.findUniqueOrThrow({
          where: { slug: 'inicio' },
        });
        await admin
          .post(`/admin/pages/${home.id}/delete`)
          .type('form')
          .send({ _csrf: token })
          .expect(422);
        await admin
          .post(`/admin/pages/${home.id}/edit`)
          .field('_csrf', token)
          .field('title', home.title)
          .field('slug', 'changed-home')
          .field('content', home.content)
          .expect(422);
      }
    );
    await t.test(
      'SUPER_ADMIN can create an account, reset its password and deactivate it',
      async () => {
        const token = csrf(await admin.get('/admin/users/new').expect(200));
        const data = {
          _csrf: token,
          name: 'Created account',
          email: `${stamp}-created@example.org`,
          role: 'EDITOR',
          active: 'on',
          password: pass,
        };
        await admin
          .post('/admin/users/new')
          .type('form')
          .send(data)
          .expect(302);
        const created = await db.user.findUniqueOrThrow({
          where: { email: data.email },
        });
        assert.ok(await bcrypt.compare(pass, created.passwordHash));
        const newPassword = pass + 'new';
        await admin
          .post(`/admin/users/${created.id}/edit`)
          .type('form')
          .send({ ...data, password: newPassword })
          .expect(302);
        const updated = await db.user.findUniqueOrThrow({
          where: { id: created.id },
        });
        assert.ok(await bcrypt.compare(newPassword, updated.passwordHash));
        assert.ok(!(await bcrypt.compare(pass, updated.passwordHash)));
        await admin
          .post(`/admin/users/${created.id}/edit`)
          .type('form')
          .send({ ...data, password: '', active: '' })
          .expect(302);
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: created.id } }))
            .active,
          false
        );
      }
    );
    await t.test(
      'account management invalidates sessions and never renders password hashes',
      async () => {
        const page = await admin
          .get(`/admin/users/${managerUser.id}/edit`)
          .expect(200);
        assert.doesNotMatch(page.text, /\$2[aby]\$|passwordHash/);
        await admin
          .post(`/admin/users/${managerUser.id}/edit`)
          .type('form')
          .send({
            _csrf: csrf(page),
            name: managerUser.name,
            email: managerUser.email,
            role: 'EDITOR',
            active: 'on',
            password: '',
          })
          .expect(302);
        await manager
          .get('/admin')
          .expect(302)
          .expect('Location', '/admin/login');
        const token = csrf(await admin.get('/admin'));
        await admin
          .post('/admin/logout')
          .type('form')
          .send({ _csrf: token })
          .expect(302);
        await admin.get('/admin').expect(302);
      }
    );
  }
);
