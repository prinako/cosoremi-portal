const service = require('../services/settings.service');
const { audit } = require('../services/content.service');
exports.form = async (req, res) =>
  res.render('admin/settings', {
    fields: service.fields,
    values: await service.read(req.app.locals.db),
  });
exports.save = async (req, res) => {
  const data = service.validate(req.body);
  await req.app.locals.db.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(data))
      await tx.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    await audit(tx, req.user.id, 'SETTING_UPDATED', 'setting', null);
  });
  res.redirect('/admin/settings');
};
