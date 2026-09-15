const { asyncRoute, httpError } = require('../utils/http');
exports.authenticate = asyncRoute(async (req, res, next) => {
  if (!req.session.userId) return res.redirect('/admin/login');
  const user = await req.app.locals.db.user.findUnique({
    where: { id: req.session.userId },
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
      sessionVersion: true,
    },
  });
  if (!user?.active || user.sessionVersion !== req.session.sessionVersion) {
    return req.session.destroy((err) =>
      err ? next(err) : res.redirect('/admin/login')
    );
  }
  req.user = user;
  res.locals.user = user;
  next();
});
exports.roles =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : next(httpError(403, 'Você não tem permissão para acessar esta área.'));
