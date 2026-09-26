import { httpError } from '../utils/http.js';

export const resources = {
  pages: {
    model: 'page',
    label: 'Páginas',
    image: 'heroImage',
    folder: 'pages',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    fields: [
      { name: 'title', label: 'Título', maxLength: 180, required: true },
      {
        name: 'slug',
        label: 'Endereço (slug)',
        maxLength: 180,
        required: true,
      },
      { name: 'subtitle', label: 'Subtítulo', maxLength: 500 },
      {
        name: 'content',
        label: 'Conteúdo',
        maxLength: 100000,
        type: 'rich-content',
        rows: 14,
        describedBy: 'rich-content-help',
      },
    ],
  },
  posts: {
    model: 'post',
    label: 'Publicações',
    image: 'featuredImage',
    folder: 'blog',
    roles: ['SUPER_ADMIN', 'ADMIN', 'EDITOR'],
    fields: [
      { name: 'title', label: 'Título', maxLength: 180, required: true },
      {
        name: 'slug',
        label: 'Endereço (slug)',
        maxLength: 180,
        required: true,
      },
      {
        name: 'summary',
        label: 'Resumo',
        maxLength: 500,
        type: 'textarea',
        rows: 4,
        describedBy: 'plain-text-help',
      },
      {
        name: 'content',
        label: 'Conteúdo',
        maxLength: 100000,
        type: 'rich-content',
        rows: 14,
        required: true,
        describedBy: 'rich-content-help',
      },
    ],
  },
  categories: {
    model: 'category',
    label: 'Categorias',
    roles: ['SUPER_ADMIN', 'ADMIN', 'EDITOR'],
    fields: [
      { name: 'name', label: 'Nome', maxLength: 120, required: true },
      {
        name: 'slug',
        label: 'Endereço (slug)',
        maxLength: 180,
        required: true,
      },
    ],
  },
  'work-areas': {
    model: 'workArea',
    label: 'Linhas de trabalho',
    image: 'image',
    folder: 'pages',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    fields: [
      { name: 'title', label: 'Título', maxLength: 180, required: true },
      {
        name: 'slug',
        label: 'Endereço (slug)',
        maxLength: 180,
        required: true,
      },
      {
        name: 'summary',
        label: 'Resumo',
        maxLength: 500,
        type: 'textarea',
        rows: 4,
        describedBy: 'plain-text-help',
      },
      {
        name: 'content',
        label: 'Conteúdo',
        maxLength: 100000,
        type: 'rich-content',
        rows: 14,
        required: true,
        describedBy: 'rich-content-help',
      },
    ],
  },
  gallery: {
    model: 'galleryItem',
    label: 'Galeria',
    image: 'image',
    folder: 'gallery',
    roles: ['SUPER_ADMIN', 'ADMIN', 'EDITOR'],
    fields: [
      { name: 'title', label: 'Título', maxLength: 180, required: true },
      {
        name: 'description',
        label: 'Descrição',
        maxLength: 2000,
        type: 'textarea',
        rows: 4,
        describedBy: 'plain-text-help',
      },
      { name: 'category', label: 'Categoria', maxLength: 120 },
    ],
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
