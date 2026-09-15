const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const { token, csrf } = require('../middleware/security');
const { asyncRoute } = require('../utils/http');
const c = require('../controllers/auth.controller');
router.get('/login', token, (req, res, next) =>
  req.session.userId ? res.redirect('/admin') : c.form(req, res, next)
);
router.post(
  '/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Muitas tentativas. Aguarde 15 minutos.',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  csrf,
  asyncRoute(c.login)
);
router.post('/logout', csrf, c.logout);
module.exports = router;
