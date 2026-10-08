import { z } from 'zod';
import { parse } from '../validators/content.js';

const short = z.string().trim().max(320);
const seoTitle = z.string().trim().max(180);
const seoDescription = z.string().trim().max(320);
const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+\d\s().-]*$/, 'Telefone inválido.');
const url = z.union([
  z.literal(''),
  z
    .url()
    .max(500)
    .refine((v) => new URL(v).protocol === 'https:', 'Use HTTPS.'),
]);
const color = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor hexadecimal no formato #RRGGBB.');

export const fields = {
  site_name: ['Nome da organização', short.min(1)],
  site_description: ['Descrição do site', short],
  primary_color: ['Cor primária', color],
  secondary_color: ['Cor secundária', color],
  phone: ['Telefone', phone],
  whatsapp: [
    'WhatsApp (com código do país)',
    z.string().max(20).regex(/^\d*$/),
  ],
  emergency_phone: ['Telefone de emergência', phone],
  institutional_email: [
    'E-mail institucional',
    z.union([z.literal(''), z.email().max(254)]),
  ],
  address: ['Endereço', short],
  office_hours: ['Horário de atendimento', short],
  facebook: ['Facebook', url],
  instagram: ['Instagram', url],
  youtube: ['YouTube', url],
  donation_text: ['Mensagem de doação', z.string().max(5000)],
  donation_pix: ['Chave PIX / informações de doação', z.string().max(500)],
  emergency_text: ['Informações de emergência', z.string().max(5000)],
  help_cta: ['Botão de ajuda', short.min(1)],
  donate_cta: ['Botão de doação', short.min(1)],
  blog_seo_title: ['Título SEO do blog', seoTitle],
  blog_seo_description: ['Descrição SEO do blog', seoDescription],
  work_areas_seo_title: ['Título SEO das linhas de trabalho', seoTitle],
  work_areas_seo_description: [
    'Descrição SEO das linhas de trabalho',
    seoDescription,
  ],
  gallery_seo_title: ['Título SEO da galeria', seoTitle],
  gallery_seo_description: ['Descrição SEO da galeria', seoDescription],
};

export const seoFieldKeys = [
  'blog_seo_title',
  'blog_seo_description',
  'work_areas_seo_title',
  'work_areas_seo_description',
  'gallery_seo_title',
  'gallery_seo_description',
];

export const defaults = {
  primary_color: '#0f5f46',
  secondary_color: '#f5c84b',
  site_logo: '',
  default_social_image: '',
  ...Object.fromEntries(seoFieldKeys.map((key) => [key, ''])),
};

const cache = new WeakMap();
const cacheDuration = 5000;

export const invalidate = (db) => cache.delete(db);

export const read = async (db) => {
  const cached = cache.get(db);
  if (cached?.expiresAt > Date.now()) return cached.promise;

  const promise = db.setting.findMany().then((rows) => ({
    ...defaults,
    ...Object.fromEntries(rows.map((setting) => [setting.key, setting.value])),
  }));
  cache.set(db, { expiresAt: Date.now() + cacheDuration, promise });

  try {
    return await promise;
  } catch (error) {
    cache.delete(db);
    throw error;
  }
};

export const validate = (body) =>
  parse(
    z.object(
      Object.fromEntries(
        Object.entries(fields).map(([key, [, schema]]) => [key, schema])
      )
    ),
    body
  );
