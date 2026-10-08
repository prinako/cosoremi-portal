import {
  resources,
  save as saveContent,
  audit,
  reservedPages,
} from '../services/content.service.js';
import * as upload from '../services/upload.service.js';
import pagination from '../utils/pagination.js';
import { httpError } from '../utils/http.js';
import { parse, schemas } from '../validators/content.js';
import { normalizeContentSubmission } from '../services/rich-content.service.js';
import * as settings from '../services/settings.service.js';
import {
  absoluteUrl,
  publicContentPath,
  reservedPageRoutes,
} from '../services/seo.service.js';

export const context = (req, res, next) => {
  const resource = req.params.resource;
  const spec = Object.hasOwn(resources, resource) ? resources[resource] : null;
  if (!spec) return next(httpError(404, 'Área não encontrada.'));
  if (!spec.roles.includes(req.user.role))
    return next(httpError(403, 'Você não tem permissão para esta área.'));
  req.resource = resource;
  req.spec = spec;
  Object.assign(res.locals, { resource, spec });
  next();
};
export const list = async (req, res) => {
  const db = req.app.locals.db[req.spec.model];
  const { page, take, skip } = pagination(req.query.page, 20);
  const [items, count] = await Promise.all([
    db.findMany({ take, skip, orderBy: { createdAt: 'desc' } }),
    db.count(),
  ]);
  res.render('admin/list', {
    items,
    page,
    pages: Math.ceil(count / take),
    base: `/admin/${req.resource}`,
  });
};
export const form = async (req, res) => {
  const db = req.app.locals.db;
  const supportsSeo = ['pages', 'posts', 'work-areas'].includes(req.resource);
  const [item, categories, siteSettings] = await Promise.all([
    req.params.id
      ? db[req.spec.model].findUniqueOrThrow({ where: { id: req.params.id } })
      : {},
    req.resource === 'posts'
      ? db.category.findMany({ orderBy: { name: 'asc' } })
      : [],
    supportsSeo ? settings.read(db) : {},
  ]);
  const siteName = siteSettings.site_name || 'COSOREMI';
  const fallbackDescription =
    (req.resource === 'pages' ? item.subtitle : item.summary) ||
    siteSettings.site_description ||
    '';
  const seoPreview = supportsSeo
    ? {
        appUrl: req.app.locals.env.appUrl,
        siteName,
        siteDescription: siteSettings.site_description || '',
        reservedPageRoutes,
        url: absoluteUrl(
          req.app.locals.env.appUrl,
          publicContentPath(req.resource, item.slug)
        ),
        title:
          item.seoTitle ||
          `${item.title || 'Título do conteúdo'} | ${siteName}`,
        description: item.seoDescription || fallbackDescription,
      }
    : null;
  res.render('admin/form', {
    item,
    categories,
    fields: req.spec.fields,
    seoPreview,
  });
};
export const save = async (req, res) => {
  const parsed = parse(schemas[req.resource], req.body);
  const existing = req.params.id
    ? await req.app.locals.db[req.spec.model].findUniqueOrThrow({
        where: { id: req.params.id },
      })
    : null;
  const data = normalizeContentSubmission(req.resource, parsed, existing);
  if (req.file && !req.spec.image)
    throw httpError(422, 'Este tipo de conteúdo não aceita imagens.');
  const image = await upload.save(req.file, req.spec.folder);
  if (image) data[req.spec.image] = image;
  else if (
    req.spec.image &&
    req.body.removeImage === 'on' &&
    req.resource !== 'gallery'
  )
    data[req.spec.image] = '';
  if (req.resource === 'gallery' && !image && !existing?.image)
    throw httpError(422, 'Selecione uma imagem para a galeria.');
  try {
    await saveContent(
      req.app.locals.db,
      req.resource,
      req.params.id,
      data,
      req.user.id
    );
  } catch (err) {
    await upload.remove(image);
    throw err;
  }
  if (
    (image ||
      (req.spec.image &&
        req.resource !== 'gallery' &&
        req.body.removeImage === 'on')) &&
    existing
  )
    await upload.remove(existing[req.spec.image]);
  res.redirect(`/admin/${req.resource}`);
};
export const remove = async (req, res) => {
  const old = await req.app.locals.db.$transaction(async (tx) => {
    const item = await tx[req.spec.model].findUniqueOrThrow({
      where: { id: req.params.id },
    });
    if (req.resource === 'pages' && reservedPages.includes(item.slug))
      throw httpError(
        422,
        'Páginas institucionais podem ser editadas ou despublicadas, mas não excluídas.'
      );
    await tx[req.spec.model].delete({ where: { id: item.id } });
    await audit(
      tx,
      req.user.id,
      `${req.spec.model.toUpperCase()}_DELETED`,
      req.spec.model,
      item.id
    );
    return item;
  });
  await upload.remove(old[req.spec.image]);
  res.redirect(`/admin/${req.resource}`);
};
