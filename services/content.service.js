import { httpError } from '../utils/http.js';

export const resources = {
  pages: {
    model: 'page',
    label: 'Páginas',
    image: 'heroImage',
    folder: 'pages',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  posts: {
    model: 'post',
    label: 'Publicações',
    image: 'featuredImage',
    folder: 'blog',
    roles: ['SUPER_ADMIN', 'ADMIN', 'EDITOR'],
  },
  categories: {
    model: 'category',
    label: 'Categorias',
    roles: ['SUPER_ADMIN', 'ADMIN', 'EDITOR'],
  },
  'work-areas': {
    model: 'workArea',
    label: 'Linhas de trabalho',
    image: 'image',
    folder: 'pages',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  gallery: {
    model: 'galleryItem',
    label: 'Galeria',
    image: 'image',
    folder: 'gallery',
    roles: ['SUPER_ADMIN', 'ADMIN', 'EDITOR'],
  },
};
export const audit = (db, userId, action, entity, entityId) =>
  db.auditLog.create({ data: { userId, action, entity, entityId } });
export const published = () => ({
  status: 'PUBLISHED',
  publishedAt: { lte: new Date() },
});
export const reservedPages = [
  'inicio',
  'sobre-nos',
  'doar',
  'emergencia',
  'contato',
];
export const save = async (db, resource, id, data, userId) =>
  db.$transaction(async (tx) => {
    const spec = resources[resource];
    if (id && resource === 'pages') {
      const old = await tx.page.findUniqueOrThrow({ where: { id } });
      if (reservedPages.includes(old.slug) && old.slug !== data.slug)
        throw httpError(422, 'O endereço desta página institucional é fixo.');
    }
    if (resource === 'posts') {
      if (!id) data.authorId = userId;
      if (data.status === 'PUBLISHED' && !data.publishedAt)
        data.publishedAt = new Date();
    }
    const item = id
      ? await tx[spec.model].update({ where: { id }, data })
      : await tx[spec.model].create({ data });
    await audit(
      tx,
      userId,
      `${spec.model.toUpperCase()}_${id ? 'UPDATED' : 'CREATED'}`,
      spec.model,
      item.id
    );
    return item;
  });
