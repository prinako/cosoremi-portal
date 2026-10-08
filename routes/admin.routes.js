import { Router } from 'express';
import { dashboard } from '../controllers/admin.controller.js';
import * as contacts from '../controllers/contacts.controller.js';
import * as content from '../controllers/content.controller.js';
import * as settings from '../controllers/settings.controller.js';
import * as users from '../controllers/users.controller.js';
import { authenticate, roles } from '../middleware/auth.middleware.js';
import { csrf, token } from '../middleware/security.js';
import upload from '../middleware/upload.middleware.js';
import { asyncRoute as wrap } from '../utils/http.js';

const router = Router();
const managers = roles('SUPER_ADMIN', 'ADMIN');

router.use(authenticate, token);
router.get('/', wrap(dashboard));
router.get('/settings', managers, wrap(settings.form));
router.post('/settings', managers, upload.settings, csrf, wrap(settings.save));
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

export default router;
