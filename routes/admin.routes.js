const router = require('express').Router();
const { authenticate, roles } = require('../middleware/auth.middleware');
const { token, csrf } = require('../middleware/security');
const { asyncRoute: wrap } = require('../utils/http');
const upload = require('../middleware/upload.middleware');
const content = require('../controllers/content.controller');
const users = require('../controllers/users.controller');
const settings = require('../controllers/settings.controller');
const contacts = require('../controllers/contacts.controller');
const managers = roles('SUPER_ADMIN', 'ADMIN');

router.use(authenticate, token);
router.get('/', wrap(require('../controllers/admin.controller').dashboard));
router.get('/settings', managers, wrap(settings.form));
router.post('/settings', managers, upload.logo, csrf, wrap(settings.save));
router.get('/users', roles('SUPER_ADMIN'), wrap(users.list));
router.get('/users/new', roles('SUPER_ADMIN'), wrap(users.form));
router.get('/users/:id/edit', roles('SUPER_ADMIN'), wrap(users.form));
router.post('/users/new', roles('SUPER_ADMIN'), csrf, wrap(users.save));
router.post('/users/:id/edit', roles('SUPER_ADMIN'), csrf, wrap(users.save));
router.get('/contacts', managers, wrap(contacts.list));
router.get('/contacts/:id', managers, wrap(contacts.show));
router.post('/contacts/:id', managers, csrf, wrap(contacts.update));
router.post('/contacts/:id/delete', managers, csrf, wrap(contacts.remove));
router.use('/:resource', content.context);
router.get('/:resource', wrap(content.list));
router.get('/:resource/new', wrap(content.form));
router.get('/:resource/:id/edit', wrap(content.form));
// Multipart is held in bounded memory, then CSRF and image contents are validated.
router.post('/:resource/new', upload, csrf, wrap(content.save));
router.post('/:resource/:id/edit', upload, csrf, wrap(content.save));
router.post('/:resource/:id/delete', csrf, wrap(content.remove));

module.exports = router;
