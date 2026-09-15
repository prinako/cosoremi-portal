const pagination = require('../utils/pagination');
const { audit } = require('../services/content.service');
exports.list = async (req, res) => {
  const { page, take, skip } = pagination(req.query.page, 20);
  const [items, count] = await Promise.all([
    req.app.locals.db.contact.findMany({
      take,
      skip,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        subject: true,
        read: true,
        createdAt: true,
      },
    }),
    req.app.locals.db.contact.count(),
  ]);
  res.render('admin/contacts', {
    items,
    page,
    pages: Math.ceil(count / take),
    base: '/admin/contacts',
  });
};
exports.show = async (req, res) =>
  res.render('admin/contact', {
    item: await req.app.locals.db.contact.findUniqueOrThrow({
      where: { id: req.params.id },
    }),
  });
exports.update = async (req, res) => {
  await req.app.locals.db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: req.params.id },
      data: { read: req.body.read === 'true' },
    });
    await audit(
      tx,
      req.user.id,
      'CONTACT_READ_UPDATED',
      'contact',
      req.params.id
    );
  });
  res.redirect('/admin/contacts');
};
exports.remove = async (req, res) => {
  await req.app.locals.db.$transaction(async (tx) => {
    await tx.contact.delete({ where: { id: req.params.id } });
    await audit(tx, req.user.id, 'CONTACT_DELETED', 'contact', req.params.id);
  });
  res.redirect('/admin/contacts');
};
