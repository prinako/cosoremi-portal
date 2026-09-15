const { parse, login } = require('../validators/content');
const auth = require('../services/auth.service');
const { audit } = require('../services/content.service');
exports.form = (req, res) => res.render('admin/auth/login', { error: '' });
exports.login = async (req, res) => {
  const input = parse(login, req.body);
  const user = await auth.verify(
    req.app.locals.db,
    input.email,
    input.password
  );
  if (!user)
    return res
      .status(401)
      .render('admin/auth/login', { error: 'E-mail ou senha inválidos.' });
  await new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  );
  req.session.userId = user.id;
  req.session.sessionVersion = user.sessionVersion;
  await audit(req.app.locals.db, user.id, 'LOGIN', 'user', user.id);
  await new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );
  res.redirect('/admin');
};
exports.logout = (req, res, next) =>
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('cosoremi.sid');
    res.redirect('/admin/login');
  });
