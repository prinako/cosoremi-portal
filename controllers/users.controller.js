const service = require('../services/user.service');
const { parse, user } = require('../validators/content');
const pagination = require('../utils/pagination');
exports.list = async (req, res) => {
  const { page, take, skip } = pagination(req.query.page, 20);
  const [items, count] = await Promise.all([
    req.app.locals.db.user.findMany({
      select: service.safeSelect,
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    }),
    req.app.locals.db.user.count(),
  ]);
  res.render('admin/users', {
    items,
    page,
    pages: Math.ceil(count / take),
    base: '/admin/users',
  });
};
exports.form = async (req, res) =>
  res.render('admin/user-form', {
    item: req.params.id
      ? await req.app.locals.db.user.findUniqueOrThrow({
          where: { id: req.params.id },
          select: service.safeSelect,
        })
      : {},
  });
exports.save = async (req, res) => {
  await service.save(
    req.app.locals.db,
    req.params.id,
    parse(user, req.body),
    req.user.id
  );
  res.redirect('/admin/users');
};
