const settings = require('../services/settings.service');
const { published } = require('../services/content.service');
const { parse, contact, subjects } = require('../validators/content');
const pagination = require('../utils/pagination');
const { httpError } = require('../utils/http');
exports.locals = async (req, res, next) => {
  const values = await settings.read(req.app.locals.db);
  Object.assign(res.locals, {
    settings: values,
    pageTitle: values.site_name || 'COSOREMI',
    pageDescription: values.site_description || '',
    image: '',
    currentUrl: req.app.locals.env.appUrl + req.path,
    active: req.path,
    appUrl: req.app.locals.env.appUrl,
  });
  next();
};
function render(res, view, item, extra = {}) {
  res.render(`pages/${view}`, {
    item,
    pageTitle:
      item.seoTitle ||
      `${item.title} | ${res.locals.settings.site_name || 'COSOREMI'}`,
    pageDescription:
      item.seoDescription ||
      item.summary ||
      item.subtitle ||
      res.locals.pageDescription,
    image: item.heroImage || item.featuredImage || item.image || '',
    ...extra,
  });
}
exports.home = async (req, res) => {
  const db = req.app.locals.db;
  const [item, about, areas, posts, gallery] = await Promise.all([
    db.page.findFirst({ where: { slug: 'inicio', published: true } }),
    db.page.findFirst({ where: { slug: 'sobre-nos', published: true } }),
    db.workArea.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
      take: 6,
    }),
    db.post.findMany({
      where: published(),
      orderBy: { publishedAt: 'desc' },
      take: 3,
    }),
    db.galleryItem.findMany({
      where: { published: true },
      orderBy: { activityDate: 'desc' },
      take: 3,
    }),
  ]);
  if (!item) throw httpError(404, 'Página não encontrada.');
  render(res, 'home', item, { about, areas, posts, gallery });
};
exports.page = async (req, res) => {
  const slug = req.params.slug || req.path.slice(1);
  const item = await req.app.locals.db.page.findFirst({
    where: { slug, published: true },
  });
  if (!item) throw httpError(404, 'Página não encontrada.');
  render(res, 'institutional', item);
};
exports.list = (type) => async (req, res) => {
  const config = {
    blog: {
      model: 'post',
      where: published(),
      orderBy: { publishedAt: 'desc' },
      title: 'Blog e notícias',
      base: '/blog',
      field: 'featuredImage',
    },
    areas: {
      model: 'workArea',
      where: { active: true },
      orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
      title: 'Linhas de trabalho',
      base: '/linhas-de-trabalho',
      field: 'image',
    },
    gallery: {
      model: 'galleryItem',
      where: { published: true },
      orderBy: { activityDate: 'desc' },
      title: 'Galeria de atividades',
      base: '/galeria',
      field: 'image',
    },
  }[type];
  if (type === 'blog' && typeof req.query.category === 'string')
    config.where.category = { slug: req.query.category.slice(0, 180) };
  const { page, take, skip } = pagination(req.query.page);
  const db = req.app.locals.db;
  const [items, count, categories] = await Promise.all([
    db[config.model].findMany({
      where: config.where,
      orderBy: config.orderBy,
      take,
      skip,
    }),
    db[config.model].count({ where: config.where }),
    type === 'blog' ? db.category.findMany({ orderBy: { name: 'asc' } }) : [],
  ]);
  render(
    res,
    'listing',
    { title: config.title },
    {
      items,
      config,
      type,
      categories,
      selectedCategory: req.query.category || '',
      page,
      pages: Math.ceil(count / take),
      base: config.base,
      filter: typeof req.query.category === 'string' ? req.query.category : '',
    }
  );
};
exports.detail = (type) => async (req, res) => {
  const db = req.app.locals.db;
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
  render(res, 'detail', item);
};
exports.contactForm = async (req, res) => {
  const item = await req.app.locals.db.page.findFirst({
    where: { slug: 'contato', published: true },
  });
  if (!item) throw httpError(404, 'Página não encontrada.');
  render(res, 'contact', item, { subjects, sent: req.query.sent === '1' });
};
exports.contact = async (req, res) => {
  await req.app.locals.db.contact.create({ data: parse(contact, req.body) });
  res.redirect(303, '/contato?sent=1');
};
