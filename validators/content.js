const { z } = require('zod');
const slug = require('../utils/slug');
const text = (max, min = 0) =>
  z
    .string()
    .trim()
    .min(min, `Use ao menos ${min} caracteres.`)
    .max(max, `Limite de ${max} caracteres.`);
const optional = (max) => text(max).default('');
const bool = z.preprocess(
  (v) => v === 'on' || v === 'true' || v === true,
  z.boolean()
);
const date = z.preprocess((v) => {
  if (v === '' || v == null) return null;
  // datetime-local fields are explicitly labelled UTC in the CMS.
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))
    return v + ':00Z';
  return v;
}, z.coerce.date().nullable());
const slugField = text(180, 1).transform(slug).pipe(text(180, 1));
const seo = { seoTitle: optional(180), seoDescription: optional(320) };
exports.schemas = {
  pages: z.object({
    title: text(180, 1),
    slug: slugField,
    subtitle: optional(500),
    content: text(100000),
    published: bool,
    ...seo,
  }),
  posts: z.object({
    title: text(180, 1),
    slug: slugField,
    summary: optional(500),
    content: text(100000, 1),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    publishedAt: date,
    categoryId: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().max(100).nullable()
    ),
    ...seo,
  }),
  categories: z.object({ name: text(120, 1), slug: slugField }),
  'work-areas': z.object({
    title: text(180, 1),
    slug: slugField,
    summary: optional(500),
    content: text(100000, 1),
    displayOrder: z.coerce.number().int().min(0).max(10000),
    active: bool,
    ...seo,
  }),
  gallery: z.object({
    title: text(180, 1),
    description: optional(2000),
    category: optional(120),
    activityDate: date,
    published: bool,
  }),
};
exports.subjects = [
  'Assistência jurídica',
  'Documentação',
  'Assistência humanitária',
  'Educação',
  'Proteção',
  'Emergência',
  'Outro',
];
exports.contact = z.object({
  name: text(120, 2),
  email: z.email().max(254),
  phone: optional(30),
  nationality: optional(80),
  subject: z.enum(exports.subjects),
  message: text(5000, 10),
});
exports.login = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
});
exports.password = z
  .string()
  .min(12, 'A senha deve ter ao menos 12 caracteres.')
  .refine(
    (v) => Buffer.byteLength(v, 'utf8') <= 72,
    'A senha deve ter no máximo 72 bytes.'
  );
exports.user = z.object({
  name: text(120, 2),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
  active: bool,
  password: z.union([z.literal(''), exports.password]).default(''),
});
exports.parse = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    const { httpError } = require('../utils/http');
    throw httpError(
      422,
      result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' ')
    );
  }
  return result.data;
};
