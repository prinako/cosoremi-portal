import { audit } from '../services/content.service.js';
import * as service from '../services/settings.service.js';
import * as uploads from '../services/upload.service.js';

export const form = async (req, res) =>
  res.render('admin/settings', {
    fields: service.fields,
    seoFieldKeys: service.seoFieldKeys,
    values: await service.read(req.app.locals.db),
  });

export const save = async (req, res) => {
  const data = service.validate(req.body);
  const current = await service.read(req.app.locals.db);
  let uploadedLogo;
  let uploadedSocialImage;
  let uploadedFavicon;
  const removeLogo = req.body.removeLogo === 'on';
  const removeSocialImage = req.body.removeSocialImage === 'on';
  const removeFavicon = req.body.removeFavicon === 'on';

  try {
    uploadedLogo = await uploads.save(req.files?.logo?.[0], 'branding');
    uploadedSocialImage = await uploads.save(
      req.files?.socialImage?.[0],
      'branding'
    );
    uploadedFavicon = await uploads.saveFavicon(req.files?.favicon?.[0]);

    if (uploadedLogo) data.site_logo = uploadedLogo;
    else if (removeLogo) data.site_logo = '';
    if (uploadedSocialImage) data.default_social_image = uploadedSocialImage;
    else if (removeSocialImage) data.default_social_image = '';
    if (uploadedFavicon) data.site_favicon = uploadedFavicon;
    else if (removeFavicon) data.site_favicon = '';

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
    await Promise.all([
      uploads.remove(uploadedLogo),
      uploads.remove(uploadedSocialImage),
      uploads.remove(uploadedFavicon),
    ]);
    throw error;
  }
  service.invalidate(req.app.locals.db);

  if ((uploadedLogo || removeLogo) && current.site_logo)
    await uploads.remove(current.site_logo);
  if (
    (uploadedSocialImage || removeSocialImage) &&
    current.default_social_image
  )
    await uploads.remove(current.default_social_image);
  if ((uploadedFavicon || removeFavicon) && current.site_favicon)
    await uploads.remove(current.site_favicon);

  res.redirect('/admin/settings');
};
