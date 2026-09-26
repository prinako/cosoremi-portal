import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';

const PgStore = connectPgSimple(session);

export default (env, store) =>
  session({
    store:
      store ||
      new PgStore({
        conString: env.databaseUrl,
        tableName: 'session',
        createTableIfMissing: false,
      }),
    name: 'cosoremi.sid',
    secret: env.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.production,
      maxAge: 8 * 60 * 60 * 1000,
    },
  });
