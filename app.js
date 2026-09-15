const express = require('express');
const helmet = require('helmet');
const path = require('node:path');
const { rateLimit } = require('express-rate-limit');
const { httpError } = require('./utils/http');
module.exports = function createApp({ db, env, sessionStore } = {}) {
  const app = express();
  app.locals.env = env || require('./config/env')();
  app.locals.db = db || require('./config/database');
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'"],
          'img-src': ["'self'"],
          'upgrade-insecure-requests': app.locals.env.production ? [] : null,
        },
      },
      strictTransportSecurity: app.locals.env.production ? undefined : false,
    })
  );
  // Readiness must work without sessions, seeded content or rate-limit state.
  app.get('/health', require('./controllers/health.controller').health);
  app.use(
    '/uploads',
    express.static(path.join(__dirname, 'public/uploads'), {
      dotfiles: 'deny',
      index: false,
      maxAge: '1d',
    })
  );
  app.use(
    express.static(path.join(__dirname, 'public'), {
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
    express.urlencoded({ extended: false, limit: '150kb', parameterLimit: 40 })
  );
  app.use(require('./config/session')(app.locals.env, sessionStore));
  app.use('/admin', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.use('/admin', require('./routes/auth.routes'));
  app.use('/admin', require('./routes/admin.routes'));
  app.use(require('./routes/public.routes'));
  app.use((req, res, next) => next(httpError(404, 'Página não encontrada.')));
  app.use(require('./middleware/error.middleware'));
  return app;
};
