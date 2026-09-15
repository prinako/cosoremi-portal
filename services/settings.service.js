const { z } = require('zod');
const { parse } = require('../validators/content');
const short = z.string().trim().max(320);
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
exports.fields = {
  site_name: ['Nome da organização', short.min(1)],
  site_description: ['Descrição do site', short],
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
};
exports.read = async (db) =>
  Object.fromEntries(
    (await db.setting.findMany()).map((s) => [s.key, s.value])
  );
exports.validate = (body) =>
  parse(
    z.object(
      Object.fromEntries(
        Object.entries(exports.fields).map(([key, [, schema]]) => [key, schema])
      )
    ),
    body
  );
