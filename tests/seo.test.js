import assert from 'node:assert/strict';
import { test } from 'node:test';
import session from 'express-session';
import request from 'supertest';
import sharp from 'sharp';
import createApp from '../app.js';
import {
  listingPageTitle,
  safeJsonLd,
  sitemapXml,
  siteStructuredData,
} from '../services/seo.service.js';
import * as uploads from '../services/upload.service.js';

const appUrl = 'https://portal.cosoremi.example';
const updatedAt = new Date('2026-02-03T04:05:06.000Z');
const publishedAt = new Date('2026-01-02T03:04:05.000Z');

test('listing page titles add pagination before one site-name suffix', () => {
  assert.equal(
    listingPageTitle('Notícias | COSOREMI', 2, 'COSOREMI'),
    'Notícias — Página 2 | COSOREMI'
  );
  assert.equal(
    listingPageTitle('Notícias do COSOREMI', 2, 'COSOREMI'),
    'Notícias do COSOREMI — Página 2 | COSOREMI'
  );
});

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

function createDb({
  settingOverrides = {},
  postItem = post,
  areaItem = area,
  pageItems = pages,
} = {}) {
  return {
    $queryRaw: async () => [{ '?column?': 1 }],
    setting: {
      findMany: async () =>
        Object.entries({
          site_name: 'COSOREMI',
          site_description: '</script><script>alert(1)</script>',
          site_logo: '/uploads/branding/logo.webp',
          site_favicon: '',
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
          default_social_image: '',
          blog_seo_title: '',
          blog_seo_description: '',
          work_areas_seo_title: '',
          work_areas_seo_description: '',
          gallery_seo_title: '',
          gallery_seo_description: '',
          ...settingOverrides,
        }).map(([key, value]) => ({ key, value })),
    },
    page: {
      findFirst: async ({ where }) =>
        pageItems.find((item) => item.slug === where.slug) || null,
      findMany: async ({ where, select }) => {
        assert.deepEqual(where, { published: true });
        assert.deepEqual(select, { slug: true, updatedAt: true });
        return pageItems.map(({ slug, updatedAt: modified }) => ({
          slug,
          updatedAt: modified,
        }));
      },
    },
    post: {
      findMany: async (query) => {
        assert.equal(query.where.status, 'PUBLISHED');
        assert.ok(query.where.publishedAt.lte instanceof Date);
        return query.take ? [postItem] : [{ slug: postItem.slug, updatedAt }];
      },
      findFirst: async ({ where }) =>
        where.slug === postItem.slug ? postItem : null,
      count: async () => 13,
    },
    workArea: {
      findMany: async (query) => {
        assert.deepEqual(query.where, { active: true });
        return query.take ? [areaItem] : [{ slug: areaItem.slug, updatedAt }];
      },
      findFirst: async ({ where }) =>
        where.slug === areaItem.slug ? areaItem : null,
      count: async () => 13,
    },
    galleryItem: {
      findMany: async () => [],
      count: async () => 13,
    },
    category: { findMany: async () => [] },
  };
}

function fixtureApp(options) {
  return createApp({
    db: createDb(options),
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

test('listing metadata uses admin overrides and preserves built-in fallbacks', async () => {
  const customized = fixtureApp({
    settingOverrides: {
      blog_seo_title: 'Notícias do COSOREMI',
      blog_seo_description: 'Acompanhe nossas publicações.',
      work_areas_seo_title: 'Como atuamos',
      work_areas_seo_description: 'Conheça nossa atuação.',
      gallery_seo_title: 'Registros de atividades',
      gallery_seo_description: 'Veja registros das atividades.',
    },
  });
  for (const [route, title, description] of [
    [
      '/blog',
      'Notícias do COSOREMI | COSOREMI',
      'Acompanhe nossas publicações.',
    ],
    [
      '/linhas-de-trabalho',
      'Como atuamos | COSOREMI',
      'Conheça nossa atuação.',
    ],
    [
      '/galeria',
      'Registros de atividades | COSOREMI',
      'Veja registros das atividades.',
    ],
  ]) {
    const response = await request(customized).get(route).expect(200);
    assert.ok(response.text.includes(`<title>${title}`));
    assert.ok(
      response.text.includes(`name="description" content="${description}"`)
    );
  }
  const secondPage = await request(customized).get('/blog?page=2').expect(200);
  assert.match(
    secondPage.text,
    /<title>Notícias do COSOREMI — Página 2 \| COSOREMI/
  );
  assert.doesNotMatch(secondPage.text, /COSOREMI \| COSOREMI/);

  const fallback = await request(fixtureApp()).get('/galeria').expect(200);
  assert.match(fallback.text, /<title>Galeria de atividades \| COSOREMI/);
  assert.match(
    fallback.text,
    /name="description" content="Galeria de atividades do COSOREMI\."/
  );

  const hostile = await request(
    fixtureApp({
      settingOverrides: {
        blog_seo_title: '</title><script>alert(1)</script>',
        blog_seo_description: '"><script>alert(1)</script>',
      },
    })
  )
    .get('/blog')
    .expect(200);
  assert.doesNotMatch(hostile.text, /<script>alert\(1\)<\/script>/);
  assert.match(hostile.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('default social image fills sharing metadata without becoming article data', async () => {
  const defaultImage = '/uploads/branding/social-default.webp';
  const app = fixtureApp({
    settingOverrides: { default_social_image: defaultImage },
    postItem: { ...post, featuredImage: '' },
    areaItem: { ...area, image: '' },
    pageItems: pages.map((item) => ({ ...item, heroImage: '' })),
  });
  for (const route of [
    '/',
    '/sobre-nos',
    `/blog/${post.slug}`,
    `/linhas-de-trabalho/${area.slug}`,
    '/blog',
    '/linhas-de-trabalho',
    '/galeria',
  ]) {
    const response = await request(app).get(route).expect(200);
    const expected = `${appUrl}${defaultImage}`;
    assert.match(
      response.text,
      new RegExp(`property="og:image" content="${expected}"`)
    );
    assert.match(
      response.text,
      new RegExp(`name="twitter:image" content="${expected}"`)
    );
  }
  const articleResponse = await request(app)
    .get(`/blog/${post.slug}`)
    .expect(200);
  const article = JSON.parse(
    headValue(
      articleResponse.text,
      /<script type="application\/ld\+json" nonce="[^"]+">([\s\S]*?)<\/script>/
    )
  );
  assert.equal(article['@type'], 'BlogPosting');
  assert.equal(article.image, undefined);

  const homepage = await request(app).get('/').expect(200);
  const graph = JSON.parse(
    headValue(
      homepage.text,
      /<script type="application\/ld\+json" nonce="[^"]+">([\s\S]*?)<\/script>/
    )
  );
  assert.equal(graph['@graph'][0].logo, `${appUrl}/uploads/branding/logo.webp`);
});

test('content-specific images take priority over the default sharing image', async () => {
  const response = await request(
    fixtureApp({
      settingOverrides: {
        default_social_image: '/uploads/branding/social-default.webp',
      },
    })
  )
    .get(`/blog/${post.slug}`)
    .expect(200);
  const expected = `${appUrl}${post.featuredImage}`;
  assert.match(
    response.text,
    new RegExp(`property="og:image" content="${expected}"`)
  );
  assert.match(
    response.text,
    new RegExp(`name="twitter:image" content="${expected}"`)
  );
  const article = JSON.parse(
    headValue(
      response.text,
      /<script type="application\/ld\+json" nonce="[^"]+">([\s\S]*?)<\/script>/
    )
  );
  assert.equal(article.image, expected);
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
