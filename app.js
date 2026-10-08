import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import dbDefault from './config/database.js';
import environment from './config/env.js';
import createSession from './config/session.js';
import { health } from './controllers/health.controller.js';
import errorMiddleware from './middleware/error.middleware.js';
import adminRouter from './routes/admin.routes.js';
import authRouter from './routes/auth.routes.js';
import publicRouter from './routes/public.routes.js';
import { httpError } from './utils/http.js';

const richEditorRequest = (req) =>
  /^\/admin\/(?:pages|posts|work-areas)\/(?:new|[^/]+\/edit)\/?$/.test(
    req.path
  );

export default function createApp({ db, env, sessionStore } = {}) {
  const app = express();
  app.locals.env = env || environment();
  app.locals.db = db || dbDefault;
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(import.meta.dirname, 'views'));
  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': [
            "'self'",
            (req, res) => `'nonce-${res.locals.cspNonce}'`,
          ],
          'style-src': [
            "'self'",
            (req, res) => `'nonce-${res.locals.cspNonce}'`,
          ],
          'style-src-attr': [
            (req) => (richEditorRequest(req) ? "'unsafe-inline'" : "'none'"),
          ],
          'img-src': ["'self'"],
          'upgrade-insecure-requests': app.locals.env.production ? [] : null,
        },
      },
      strictTransportSecurity: app.locals.env.production ? undefined : false,
    })
  );
  // Readiness must work without sessions, seeded content or rate-limit state.
  app.get(
    '/health',
    (req, res, next) => {
      res.set('X-Robots-Tag', 'noindex, nofollow');
      next();
    },
    health
  );
  app.use(
    '/uploads',
    express.static(path.join(import.meta.dirname, 'public/uploads'), {
      dotfiles: 'deny',
      index: false,
      maxAge: '1d',
    })
  );
  app.use(
    express.static(path.join(import.meta.dirname, 'public'), {
      dotfiles: 'deny',
      index: false,
    })
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 500,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: 'Muitas solicitações. Tente novamente mais tarde.',
    })
  );
  app.use(
    express.urlencoded({ extended: false, limit: '300kb', parameterLimit: 40 })
  );
  app.use(createSession(app.locals.env, sessionStore));
  app.use('/admin', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.use('/admin', authRouter);
  app.use('/admin', adminRouter);
  app.use(publicRouter);
  app.use((req, res, next) => next(httpError(404, 'Página não encontrada.')));
  app.use(errorMiddleware);
  return app;
}
