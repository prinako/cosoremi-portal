import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as c from '../controllers/public.controller.js';
import * as seo from '../controllers/seo.controller.js';
import { csrf, token } from '../middleware/security.js';
import { asyncRoute as wrap } from '../utils/http.js';

const router = Router();

router.get('/robots.txt', seo.robots);
router.get('/sitemap.xml', wrap(seo.sitemap));
router.use(wrap(c.locals));
router.get('/theme.css', c.theme);
router.get('/', wrap(c.home));
router.get(['/sobre-nos', '/doar', '/emergencia'], wrap(c.page));
router.get('/paginas/:slug', c.canonicalPage, wrap(c.page));
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

export default router;
