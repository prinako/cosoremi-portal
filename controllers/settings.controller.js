import { audit } from '../services/content.service.js';
import * as service from '../services/settings.service.js';
import * as uploads from '../services/upload.service.js';

export const form = async (req, res) =>
  res.render('admin/settings', {
    fields: service.fields,
    values: await service.read(req.app.locals.db),
  });

export const save = async (req, res) => {
  const data = service.validate(req.body);
  const current = await service.read(req.app.locals.db);
  const uploadedLogo = await uploads.save(req.file, 'branding');
  const removeLogo = req.body.removeLogo === 'on';

  if (uploadedLogo) data.site_logo = uploadedLogo;
  else if (removeLogo) data.site_logo = '';

  try {
    await req.app.locals.db.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(data))
        await tx.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });
      await audit(tx, req.user.id, 'SETTING_UPDATED', 'setting', null);
    });
  } catch (error) {
    await uploads.remove(uploadedLogo);
    throw error;
  }

  if ((uploadedLogo || removeLogo) && current.site_logo)
    await uploads.remove(current.site_logo);

  res.redirect('/admin/settings');
};
