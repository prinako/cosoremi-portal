const { published } = require('../services/content.service');
exports.dashboard = async (req, res) => {
  const db = req.app.locals.db;
  const canReadContacts = req.user.role !== 'EDITOR';
  const [posts, drafts, gallery, areas, unread, activity] = await Promise.all([
    db.post.count({ where: published() }),
    db.post.count({ where: { status: 'DRAFT' } }),
    db.galleryItem.count(),
    db.workArea.count(),
    canReadContacts
      ? db.contact.count({ where: { read: false } })
      : Promise.resolve(null),
    db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: canReadContacts ? {} : { userId: req.user.id },
      include: { user: { select: { name: true } } },
    }),
  ]);
  res.render('admin/dashboard', {
    counts: {
      'Publicações no ar': posts,
      Rascunhos: drafts,
      'Imagens na galeria': gallery,
      'Linhas de trabalho': areas,
      ...(canReadContacts ? { 'Mensagens não lidas': unread } : {}),
    },
    activity,
  });
};
