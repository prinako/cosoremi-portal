const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const { asyncRoute: wrap } = require('../utils/http');
const { token, csrf } = require('../middleware/security');
const c = require('../controllers/public.controller');
router.use(wrap(c.locals));
router.get('/', wrap(c.home));
router.get(['/sobre-nos', '/doar', '/emergencia'], wrap(c.page));
router.get('/paginas/:slug', wrap(c.page));
router.get('/linhas-de-trabalho', wrap(c.list('areas')));
router.get('/linhas-de-trabalho/:slug', wrap(c.detail('areas')));
router.get('/blog', wrap(c.list('blog')));
router.get('/blog/:slug', wrap(c.detail('blog')));
router.get('/galeria', wrap(c.list('gallery')));
router.get('/contato', token, wrap(c.contactForm));
router.post(
  '/contato',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    message: 'Limite de mensagens atingido. Tente mais tarde.',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  csrf,
  wrap(c.contact)
);
module.exports = router;
