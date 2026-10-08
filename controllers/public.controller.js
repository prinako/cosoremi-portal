import { published } from '../services/content.service.js';
import { renderRichContent } from '../services/rich-content.service.js';
import * as settings from '../services/settings.service.js';
import {
  absoluteUrl,
  blogPostingStructuredData,
  listingPageTitle,
  listingUrl,
  publicMediaUrl,
  reservedPageRoutes,
  safeJsonLd,
  siteStructuredData,
} from '../services/seo.service.js';
import pagination from '../utils/pagination.js';
import { httpError } from '../utils/http.js';
import {
  contact as contactSchema,
  parse,
  publicListQuery,
  subjects,
} from '../validators/content.js';

const cardSelect = {
  post: {
    title: true,
    slug: true,
    summary: true,
    featuredImage: true,
  },
  workArea: {
    title: true,
    slug: true,
    summary: true,
    image: true,
  },
  galleryItem: {
    title: true,
    description: true,
    image: true,
    activityDate: true,
  },
};

const listing = {
  blog: {
    model: 'post',
    where: published,
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    title: 'Blog e notícias',
    description: 'Notícias e publicações do COSOREMI.',
    titleSetting: 'blog_seo_title',
    descriptionSetting: 'blog_seo_description',
    base: '/blog',
    field: 'featuredImage',
  },
  areas: {
    model: 'workArea',
    where: () => ({ active: true }),
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }, { id: 'asc' }],
    title: 'Linhas de trabalho',
    description: 'Conheça as linhas de trabalho do COSOREMI.',
    titleSetting: 'work_areas_seo_title',
    descriptionSetting: 'work_areas_seo_description',
    base: '/linhas-de-trabalho',
    field: 'image',
  },
  gallery: {
    model: 'galleryItem',
    where: () => ({ published: true }),
    orderBy: [
      { activityDate: { sort: 'desc', nulls: 'last' } },
      { id: 'desc' },
    ],
    title: 'Galeria de atividades',
    description: 'Galeria de atividades do COSOREMI.',
    titleSetting: 'gallery_seo_title',
    descriptionSetting: 'gallery_seo_description',
    base: '/galeria',
    field: 'image',
  },
};

function requireConfig(config, type) {
  if (!config) throw new TypeError(`Tipo público desconhecido: ${type}`);
  return config;
}

const safeColor = (value, fallback) =>
  /^#[0-9a-fA-F]{6}$/.test(value || '') ? value.toLowerCase() : fallback;

function mixColor(hex, target, amount) {
  const parseHex = (value) =>
    [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  const source = parseHex(hex);
  const destination = parseHex(target);
  const mixed = source.map((channel, index) =>
    Math.round(channel + (destination[index] - channel) * amount)
  );
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export const locals = async (req, res, next) => {
  const values = await settings.read(req.app.locals.db);
  res.set('Cache-Control', 'no-store, max-age=0');
  Object.assign(res.locals, {
    settings: values,
    pageTitle: values.site_name || 'COSOREMI',
    pageDescription: values.site_description || '',
    image: '',
    canonicalUrl: absoluteUrl(req.app.locals.env.appUrl, req.path),
    robots: 'index, follow',
    ogType: 'website',
    structuredData: '',
    active: req.path,
    appUrl: req.app.locals.env.appUrl,
  });
  next();
};

export const theme = (req, res) => {
  const primary = safeColor(res.locals.settings.primary_color, '#0f5f46');
  const secondary = safeColor(res.locals.settings.secondary_color, '#f5c84b');

  res.type('text/css');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(`:root {
  --primary-color: ${primary};
  --secondary-color: ${secondary};
  --green-950: ${mixColor(primary, '#000000', 0.4)};
  --green-900: ${mixColor(primary, '#000000', 0.25)};
  --green-800: ${primary};
  --green-700: ${mixColor(primary, '#ffffff', 0.14)};
  --green-100: ${mixColor(primary, '#ffffff', 0.86)};
  --yellow-500: ${secondary};
  --yellow-100: ${mixColor(secondary, '#ffffff', 0.78)};
}`);
};

function render(res, view, item, extra = {}) {
  const appUrl = res.locals.appUrl;
  const contentImage = publicMediaUrl(
    appUrl,
    item.heroImage || item.featuredImage || item.image || ''
  );
  const metadata = {
    pageTitle:
      item.seoTitle ||
      `${item.title} | ${res.locals.settings.site_name || 'COSOREMI'}`,
    pageDescription:
      item.seoDescription ||
      item.summary ||
      item.subtitle ||
      res.locals.pageDescription,
    image:
      contentImage ||
      publicMediaUrl(appUrl, res.locals.settings.default_social_image),
    ...extra.metadata,
  };
  const data = {
    item,
    ...metadata,
    contentHtml:
      typeof item.content === 'string'
        ? renderRichContent(item.contentBlocks, item.content)
        : '',
    ...extra,
  };
  delete data.metadata;
  if (extra.structuredData)
    data.structuredData = safeJsonLd(
      extra.structuredData(metadata, { contentImage })
    );
  res.render(`pages/${view}`, data);
}

export const home = async (req, res) => {
  const db = req.app.locals.db;
  const [item, about, areas, posts, gallery] = await Promise.all([
    db.page.findFirst({ where: { slug: 'inicio', published: true } }),
    db.page.findFirst({
      where: { slug: 'sobre-nos', published: true },
      select: { title: true, subtitle: true },
    }),
    db.workArea.findMany({
      where: { active: true },
      orderBy: listing.areas.orderBy,
      select: cardSelect.workArea,
      take: 6,
    }),
    db.post.findMany({
      where: published(),
      orderBy: listing.blog.orderBy,
      select: cardSelect.post,
      take: 3,
    }),
    db.galleryItem.findMany({
      where: { published: true },
      orderBy: listing.gallery.orderBy,
      select: cardSelect.galleryItem,
      take: 3,
    }),
  ]);
  if (!item) throw httpError(404, 'Página não encontrada.');
  render(res, 'home', item, {
    about,
    areas,
    posts,
    gallery,
    metadata: { canonicalUrl: absoluteUrl(res.locals.appUrl, '/') },
    structuredData: () =>
      siteStructuredData(res.locals.settings, res.locals.appUrl),
  });
};

export const canonicalPage = (req, res, next) => {
  const destination = reservedPageRoutes[req.params.slug];
  return destination ? res.redirect(308, destination) : next();
};

export const page = async (req, res) => {
  const slug = req.params.slug || req.path.slice(1);
  const item = await req.app.locals.db.page.findFirst({
    where: { slug, published: true },
  });
  if (!item) throw httpError(404, 'Página não encontrada.');
  render(res, 'institutional', item, {
    metadata: {
      canonicalUrl: absoluteUrl(
        res.locals.appUrl,
        reservedPageRoutes[slug] || `/paginas/${encodeURIComponent(slug)}`
      ),
    },
  });
};

export const list = (type) => async (req, res) => {
  const config = requireConfig(listing[type], type);
  const { category } =
    type === 'blog' ? parse(publicListQuery, req.query) : { category: '' };
  const where = category
    ? { ...config.where(), category: { slug: category } }
    : config.where();
  const { page, take, skip } = pagination(req.query.page);
  const db = req.app.locals.db;
  const [items, count, categories] = await Promise.all([
    db[config.model].findMany({
      where,
      orderBy: config.orderBy,
      select: cardSelect[config.model],
      take,
      skip,
    }),
    db[config.model].count({ where }),
    type === 'blog'
      ? db.category.findMany({
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: { name: true, slug: true },
        })
      : [],
  ]);
  const pages = Math.max(1, Math.ceil(count / take));
  if (page > pages) throw httpError(404, 'Página não encontrada.');

  const siteName = res.locals.settings.site_name || 'COSOREMI';
  const listingTitle = res.locals.settings[config.titleSetting] || config.title;
  const listingDescription =
    res.locals.settings[config.descriptionSetting] || config.description;
  render(
    res,
    'listing',
    { title: config.title },
    {
      items,
      config,
      type,
      categories,
      selectedCategory: category,
      page,
      pages,
      base: config.base,
      filter: category,
      metadata: {
        pageTitle: listingPageTitle(listingTitle, page, siteName),
        pageDescription: listingDescription,
        canonicalUrl: listingUrl(res.locals.appUrl, config.base, page),
        robots: category ? 'noindex, follow' : 'index, follow',
      },
    }
  );
};

export const detail = (type) => async (req, res) => {
  const db = req.app.locals.db;
  if (!['blog', 'areas'].includes(type))
    throw new TypeError(`Tipo público desconhecido: ${type}`);
  const item =
    type === 'blog'
      ? await db.post.findFirst({
          where: { slug: req.params.slug, ...published() },
          include: { category: true, author: { select: { name: true } } },
        })
      : await db.workArea.findFirst({
          where: { slug: req.params.slug, active: true },
        });
  if (!item) throw httpError(404, 'Página não encontrada.');
  const pathname =
    type === 'blog'
      ? `/blog/${encodeURIComponent(item.slug)}`
      : `/linhas-de-trabalho/${encodeURIComponent(item.slug)}`;
  const metadata = {
    canonicalUrl: absoluteUrl(res.locals.appUrl, pathname),
    ogType: type === 'blog' ? 'article' : 'website',
  };
  const extra = { metadata };
  if (
    type === 'blog' &&
    item.publishedAt &&
    item.updatedAt &&
    item.author?.name
  )
    extra.structuredData = (resolvedMetadata, { contentImage }) =>
      blogPostingStructuredData(
        item,
        resolvedMetadata,
        res.locals.settings,
        res.locals.appUrl,
        contentImage
      );
  render(res, 'detail', item, extra);
};

export const contactForm = async (req, res) => {
  const item = await req.app.locals.db.page.findFirst({
    where: { slug: 'contato', published: true },
  });
  if (!item) throw httpError(404, 'Página não encontrada.');
  render(res, 'contact', item, {
    subjects,
    sent: req.query.sent === '1',
    metadata: { canonicalUrl: absoluteUrl(res.locals.appUrl, '/contato') },
  });
};

export const contact = async (req, res) => {
  await req.app.locals.db.contact.create({
    data: parse(contactSchema, req.body),
  });
  res.redirect(303, '/contato?sent=1');
};
