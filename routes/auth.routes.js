import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as c from '../controllers/auth.controller.js';
import { csrf, token } from '../middleware/security.js';
import { asyncRoute } from '../utils/http.js';

const router = Router();
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
export default router;
