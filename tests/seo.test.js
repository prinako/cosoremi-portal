import assert from 'node:assert/strict';
import { test } from 'node:test';
import session from 'express-session';
import request from 'supertest';
import createApp from '../app.js';
import {
  safeJsonLd,
  sitemapXml,
  siteStructuredData,
} from '../services/seo.service.js';

const appUrl = 'https://portal.cosoremi.example';
const updatedAt = new Date('2026-02-03T04:05:06.000Z');
const publishedAt = new Date('2026-01-02T03:04:05.000Z');
const pages = [
  {
    slug: 'inicio',
    title: 'Início',
    subtitle: 'Acolhimento',
    content: 'Conteúdo inicial',
    heroImage: '/uploads/pages/home.webp',
    seoTitle: '',
    seoDescription: '',
    updatedAt,
  },
  {
    slug: 'sobre-nos',
    title: 'Sobre nós',
    subtitle: 'Subtítulo real',
    content: 'Conteúdo sobre',
    heroImage: '',
    seoTitle: 'Título SEO institucional',
    seoDescription: 'Descrição SEO institucional',
    updatedAt,
  },
  ...['doar', 'emergencia', 'contato'].map((slug) => ({
    slug,
    title: slug,
    subtitle: `Informações de ${slug}`,
    content: `Conteúdo de ${slug}`,
    heroImage: '',
    seoTitle: '',
    seoDescription: '',
    updatedAt,
  })),
  {
    slug: 'pagina-publica',
    title: 'Página pública',
    subtitle: 'Página adicional',
    content: 'Conteúdo adicional',
    heroImage: '',
    seoTitle: '',
    seoDescription: '',
    updatedAt,
  },
];
const post = {
  slug: 'noticia-publicada',
  title: 'Notícia publicada',
  summary: 'Resumo da notícia',
  content: 'Texto da notícia',
  contentBlocks: null,
  featuredImage: '/uploads/blog/noticia.webp',
  seoTitle: '',
  seoDescription: '',
  status: 'PUBLISHED',
  publishedAt,
  updatedAt,
  author: { name: 'Autora real' },
  category: null,
};
const area = {
  slug: 'acolhimento',
  title: 'Acolhimento',
  summary: 'Resumo da linha',
  content: 'Conteúdo da linha',
  contentBlocks: null,
  image: '/uploads/pages/area.webp',
  seoTitle: '',
  seoDescription: '',
  active: true,
  updatedAt,
};

function createDb() {
  return {
    $queryRaw: async () => [{ '?column?': 1 }],
    setting: {
      findMany: async () =>
        Object.entries({
          site_name: 'COSOREMI',
          site_description: '</script><script>alert(1)</script>',
          site_logo: '/uploads/branding/logo.webp',
          primary_color: '#0f5f46',
          secondary_color: '#f5c84b',
          institutional_email: 'contato@cosoremi.example',
          phone: '',
          facebook: 'https://www.facebook.com/cosoremi',
          instagram: '',
          youtube: '',
          donation_text: '',
          donation_pix: '',
          emergency_text: '',
          emergency_phone: '',
          help_cta: 'Ajuda',
          donate_cta: 'Doar',
        }).map(([key, value]) => ({ key, value })),
    },
    page: {
      findFirst: async ({ where }) =>
        pages.find((item) => item.slug === where.slug) || null,
      findMany: async ({ where, select }) => {
        assert.deepEqual(where, { published: true });
        assert.deepEqual(select, { slug: true, updatedAt: true });
        return pages.map(({ slug, updatedAt: modified }) => ({
          slug,
          updatedAt: modified,
        }));
      },
    },
    post: {
      findMany: async (query) => {
        assert.equal(query.where.status, 'PUBLISHED');
        assert.ok(query.where.publishedAt.lte instanceof Date);
        return query.take ? [post] : [{ slug: post.slug, updatedAt }];
      },
      findFirst: async ({ where }) => (where.slug === post.slug ? post : null),
      count: async () => 13,
    },
    workArea: {
      findMany: async (query) => {
        assert.deepEqual(query.where, { active: true });
        return query.take ? [area] : [{ slug: area.slug, updatedAt }];
      },
      findFirst: async ({ where }) => (where.slug === area.slug ? area : null),
      count: async () => 13,
    },
    galleryItem: {
      findMany: async () => [],
      count: async () => 13,
    },
    category: { findMany: async () => [] },
  };
}

function fixtureApp() {
  return createApp({
    db: createDb(),
    sessionStore: new session.MemoryStore(),
    env: {
      databaseUrl: 'postgresql://unused.example/test',
      secret: 'test-session-secret-at-least-32-characters',
      appUrl,
      production: true,
    },
  });
}

function headValue(html, expression) {
  const match = html.match(expression);
  assert.ok(match, `Metadata not found: ${expression}`);
  return match[1];
}

test('representative public pages render semantic metadata from APP_URL', async () => {
  const app = fixtureApp();
  const cases = [
    ['/', '/', 'website'],
    ['/sobre-nos', '/sobre-nos', 'website'],
    ['/blog', '/blog', 'website'],
    [`/blog/${post.slug}`, `/blog/${post.slug}`, 'article'],
    ['/linhas-de-trabalho', '/linhas-de-trabalho', 'website'],
    [
      `/linhas-de-trabalho/${area.slug}`,
      `/linhas-de-trabalho/${area.slug}`,
      'website',
    ],
    ['/galeria', '/galeria', 'website'],
    ['/contato?sent=1&utm_source=test', '/contato', 'website'],
  ];
  for (const [route, canonicalPath, ogType] of cases) {
    const response = await request(app).get(route).expect(200);
    assert.equal(
      headValue(response.text, /<link rel="canonical" href="([^"]+)"/),
      new URL(canonicalPath, appUrl).href
    );
    assert.equal(
      headValue(response.text, /<meta name="robots" content="([^"]+)"/),
      'index, follow'
    );
    assert.equal(
      headValue(response.text, /<meta property="og:type" content="([^"]+)"/),
      ogType
    );
    assert.equal(
      headValue(response.text, /<meta property="og:url" content="([^"]+)"/),
      new URL(canonicalPath, appUrl).href
    );
    assert.match(response.text, /<meta name="twitter:card"/);
    assert.match(response.text, /<meta name="twitter:title"/);
    assert.match(response.text, /<meta name="twitter:description"/);
    assert.equal((response.text.match(/rel="canonical"/g) || []).length, 1);
  }

  const institutional = await request(app).get('/sobre-nos').expect(200);
  assert.match(institutional.text, /<title>Título SEO institucional/);
  assert.match(
    institutional.text,
    /name="description" content="Descrição SEO institucional"/
  );
  const fallback = await request(app)
    .get(`/linhas-de-trabalho/${area.slug}`)
    .expect(200);
  assert.match(fallback.text, /<title>Acolhimento \| COSOREMI/);
  assert.match(fallback.text, /name="description" content="Resumo da linha"/);
  assert.match(
    fallback.text,
    /property="og:image" content="https:\/\/portal\.cosoremi\.example\/uploads\/pages\/area\.webp"/
  );
});

test('pagination is self-canonical and category filters are noindex', async () => {
  const app = fixtureApp();
  const page = await request(app).get('/blog?page=2').expect(200);
  assert.match(page.text, /<title>Blog e notícias — Página 2 \| COSOREMI/);
  assert.match(
    page.text,
    /rel="canonical" href="https:\/\/portal\.cosoremi\.example\/blog\?page=2"/
  );
  const filter = await request(app)
    .get('/blog?category=direitos-humanos&page=2')
    .expect(200);
  assert.match(filter.text, /name="robots" content="noindex, follow"/);
  assert.match(
    filter.text,
    /rel="canonical" href="https:\/\/portal\.cosoremi\.example\/blog\?page=2"/
  );
  await request(app).get('/blog?page=3').expect(404);
});

test('reserved page duplicates redirect permanently and custom pages remain public', async () => {
  const app = fixtureApp();
  for (const [slug, destination] of Object.entries({
    inicio: '/',
    'sobre-nos': '/sobre-nos',
    doar: '/doar',
    emergencia: '/emergencia',
    contato: '/contato',
  }))
    await request(app)
      .get(`/paginas/${slug}`)
      .expect(308)
      .expect('Location', destination);
  await request(app).get('/paginas/pagina-publica').expect(200);
  await request(app).get('/paginas/desconhecida').expect(404);
});

test('robots and sitemap expose only canonical public URL classes', async () => {
  const app = fixtureApp();
  const robots = await request(app).get('/robots.txt').expect(200);
  assert.match(robots.headers['content-type'], /^text\/plain/);
  assert.equal(
    robots.text,
    `User-agent: *\nAllow: /\nDisallow: /health\nSitemap: ${appUrl}/sitemap.xml\n`
  );
  assert.match(robots.headers['cache-control'], /^public/);

  const sitemap = await request(app).get('/sitemap.xml').expect(200);
  assert.match(sitemap.headers['content-type'], /application\/xml/);
  assert.match(sitemap.headers['cache-control'], /^public/);
  assert.match(sitemap.text, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(
    sitemap.text,
    /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/
  );
  for (const path of [
    '/',
    '/sobre-nos',
    '/pagina-publica',
    `/blog/${post.slug}`,
    `/linhas-de-trabalho/${area.slug}`,
    '/blog',
    '/linhas-de-trabalho',
    '/galeria',
  ]) {
    const actualPath =
      path === '/pagina-publica' ? '/paginas/pagina-publica' : path;
    assert.match(sitemap.text, new RegExp(new URL(actualPath, appUrl).href));
  }
  for (const excluded of [
    '/paginas/inicio',
    '/paginas/sobre-nos',
    '/admin',
    '/admin/login',
    '/health',
    '?category=',
  ])
    assert.doesNotMatch(sitemap.text, new RegExp(excluded.replace('?', '\\?')));
  assert.match(sitemap.text, /<lastmod>2026-02-03T04:05:06\.000Z<\/lastmod>/);
});

test('structured data is valid, minimal and safe inside a script element', async () => {
  const response = await request(fixtureApp()).get('/').expect(200);
  const jsonText = headValue(
    response.text,
    /<script type="application\/ld\+json" nonce="[^"]+">([\s\S]*?)<\/script>/
  );
  assert.doesNotMatch(jsonText, /<\/script>/i);
  const data = JSON.parse(jsonText);
  assert.deepEqual(
    data['@graph'].map((entry) => entry['@type']),
    ['Organization', 'WebSite']
  );
  const organization = data['@graph'][0];
  assert.equal(organization.url, `${appUrl}/`);
  assert.equal(organization.address, undefined);
  assert.equal(organization.telephone, undefined);
  assert.deepEqual(organization.sameAs, ['https://www.facebook.com/cosoremi']);
  assert.match(
    response.headers['content-security-policy'],
    /script-src 'self' 'nonce-/
  );

  const articleResponse = await request(fixtureApp())
    .get(`/blog/${post.slug}`)
    .expect(200);
  const article = JSON.parse(
    headValue(
      articleResponse.text,
      /<script type="application\/ld\+json" nonce="[^"]+">([\s\S]*?)<\/script>/
    )
  );
  assert.equal(article['@type'], 'BlogPosting');
  assert.equal(article.datePublished, publishedAt.toISOString());
  assert.equal(article.dateModified, updatedAt.toISOString());
  assert.equal(article.author.name, 'Autora real');
  assert.equal(article.mainEntityOfPage, `${appUrl}/blog/${post.slug}`);
});

test('XML and JSON-LD serializers escape markup-significant CMS text', () => {
  const xml = sitemapXml([{ loc: 'https://example.test/path?a=1&b=<unsafe>' }]);
  assert.match(xml, /a=1&amp;b=&lt;unsafe&gt;/);
  const json = safeJsonLd({ value: '</script><script>alert(1)</script>' });
  assert.doesNotMatch(json, /<\/script>/i);
  assert.deepEqual(JSON.parse(json), {
    value: '</script><script>alert(1)</script>',
  });

  const data = siteStructuredData(
    { site_name: 'COSOREMI', facebook: 'javascript:alert(1)' },
    appUrl
  );
  assert.equal(data['@graph'][0].sameAs, undefined);
});

test('admin and health responses keep explicit non-indexing headers', async () => {
  const app = fixtureApp();
  for (const path of ['/admin', '/admin/login', '/admin/posts'])
    assert.equal(
      (await request(app).get(path)).headers['x-robots-tag'],
      'noindex, nofollow'
    );
  assert.equal(
    (await request(app).get('/health').expect(200)).headers['x-robots-tag'],
    'noindex, nofollow'
  );
});
