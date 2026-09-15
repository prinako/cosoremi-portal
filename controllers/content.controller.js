const {
  resources,
  save,
  audit,
  reservedPages,
} = require('../services/content.service');
const { schemas, parse } = require('../validators/content');
const upload = require('../services/upload.service');
const pagination = require('../utils/pagination');
const { httpError } = require('../utils/http');
exports.context = (req, res, next) => {
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
exports.list = async (req, res) => {
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
exports.form = async (req, res) => {
  const item = req.params.id
    ? await req.app.locals.db[req.spec.model].findUniqueOrThrow({
        where: { id: req.params.id },
      })
    : {};
  const categories =
    req.resource === 'posts'
      ? await req.app.locals.db.category.findMany({ orderBy: { name: 'asc' } })
      : [];
  res.render('admin/form', { item, categories });
};
exports.save = async (req, res) => {
  const data = parse(schemas[req.resource], req.body);
  const existing = req.params.id
    ? await req.app.locals.db[req.spec.model].findUniqueOrThrow({
        where: { id: req.params.id },
      })
    : null;
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
    await save(
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
exports.remove = async (req, res) => {
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
