require('dotenv').config({ quiet: true });
const db = require('../config/database');
const bcrypt = require('bcrypt');
const slug = require('../utils/slug');
const { password } = require('../validators/content');
const { z } = require('zod');
const { httpError } = require('../utils/http');
const settings = {
  site_name: 'COSOREMI',
  site_description:
    'Comité de Solidariedade dos Refugiados e Migrantes. Solidariedade, acolhimento e proteção no Pará.',
  phone: '',
  whatsapp: '',
  emergency_phone: '',
  institutional_email: '',
  address: '',
  office_hours: '',
  facebook: '',
  instagram: '',
  youtube: '',
  donation_text:
    'Sua solidariedade fortalece o acolhimento de refugiados e migrantes. Entre em contato para conhecer as formas de apoiar o COSOREMI.',
  donation_pix: '',
  emergency_text:
    'Precisa de acolhimento ou orientação? Consulte os canais de contato do COSOREMI. O atendimento pelo site não é imediato.',
  help_cta: 'Preciso de ajuda',
  donate_cta: 'Quero ajudar',
};
const pages = [
  {
    slug: 'inicio',
    title: 'Solidariedade, acolhimento e proteção',
    subtitle: 'Para refugiados e migrantes no Pará.',
    content:
      'Acolher é construir caminhos de dignidade, participação e acesso a direitos.',
  },
  {
    slug: 'sobre-nos',
    title: 'Sobre o COSOREMI',
    subtitle: 'Comité de Solidariedade dos Refugiados e Migrantes',
    content:
      'O COSOREMI atua na solidariedade e no acolhimento de refugiados e migrantes no Pará, promovendo orientação, apoio e acesso a direitos.\n\nConheça nossas linhas de trabalho e entre em contato para saber como participar.',
  },
  {
    slug: 'doar',
    title: 'Sua ajuda faz a diferença',
    subtitle: 'Participe de uma rede de solidariedade.',
    content:
      'Apoie as iniciativas de acolhimento e assistência. Consulte os canais institucionais para conhecer as necessidades e formas de contribuir.',
  },
  {
    slug: 'emergencia',
    title: 'Emergência e proteção',
    subtitle: 'Informação e orientação para buscar apoio.',
    content:
      'Entre em contato pelos canais institucionais disponíveis. Não envie documentos ou informações pessoais sensíveis pelo formulário público.',
  },
  {
    slug: 'contato',
    title: 'Fale com o COSOREMI',
    subtitle: 'Estamos construindo caminhos de acolhimento.',
    content:
      'Use este espaço para um primeiro contato, solicitar informações ou oferecer apoio. Os campos com asterisco são obrigatórios.',
  },
];
const areas = [
  [
    'Assistência e Orientação para Migrantes e Refugiados no Pará',
    'Acolhimento e orientação para acesso a direitos e serviços.',
  ],
  [
    'Assistência Educacional e Material',
    'Apoio à educação e às necessidades materiais de acolhimento.',
  ],
  [
    'Fortalecimento da Mobilidade nas Comunidades Migrantes e Refugiadas',
    'Apoio à participação e à mobilidade nas comunidades.',
  ],
  [
    'Prevenção e Combate ao Trabalho Análogo à Escravidão',
    'Informação e orientação para a proteção da dignidade no trabalho.',
  ],
  [
    'Regularização de Documentos',
    'Orientação sobre caminhos de acesso à documentação.',
  ],
  [
    'Linha de Emergência e Proteção',
    'Acolhimento e encaminhamento para redes de proteção.',
  ],
];

function readAdministrator() {
  const hasAdminEmail = Boolean(process.env.ADMIN_EMAIL);
  const hasAdminPassword = Boolean(process.env.ADMIN_PASSWORD);
  if (hasAdminEmail !== hasAdminPassword) {
    throw new Error(
      'ADMIN_EMAIL e ADMIN_PASSWORD devem ser informados juntos.'
    );
  }
  if (!hasAdminEmail) return null;

  const emailResult = z
    .email()
    .max(254)
    .safeParse(process.env.ADMIN_EMAIL.toLowerCase());
  if (!emailResult.success)
    throw httpError(422, 'ADMIN_EMAIL deve ser um endereço de e-mail válido.');
  const passwordResult = password.safeParse(process.env.ADMIN_PASSWORD);
  if (!passwordResult.success)
    throw httpError(422, 'ADMIN_PASSWORD deve ter de 12 a 72 bytes UTF-8.');
  const nameResult = z
    .string()
    .trim()
    .min(2)
    .max(120)
    .safeParse(process.env.ADMIN_NAME || 'Administração COSOREMI');
  if (!nameResult.success)
    throw httpError(422, 'ADMIN_NAME deve ter de 2 a 120 caracteres.');

  return {
    email: emailResult.data,
    password: passwordResult.data,
    name: nameResult.data,
  };
}

async function seed() {
  // Validate optional account configuration before making database changes.
  const administrator = readAdministrator();

  // Idempotent: never overwrite content or credentials edited by administrators.
  for (const [key, value] of Object.entries(settings))
    await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  for (const page of pages)
    await db.page.upsert({
      where: { slug: page.slug },
      create: { ...page, published: true },
      update: {},
    });
  for (const [index, [title, summary]] of areas.entries())
    await db.workArea.upsert({
      where: { slug: slug(title) },
      create: {
        title,
        slug: slug(title),
        summary,
        content: `${summary}\n\nEntre em contato com o COSOREMI para obter mais informações sobre esta linha de trabalho.`,
        displayOrder: index + 1,
      },
      update: {},
    });
  for (const name of ['Notícias', 'Atividades', 'Institucional'])
    await db.category.upsert({
      where: { slug: slug(name) },
      create: { name, slug: slug(name) },
      update: {},
    });
  if (administrator) {
    const { email, password: validPassword, name } = administrator;
    await db.user.upsert({
      where: { email },
      create: {
        email,
        name,
        passwordHash: await bcrypt.hash(validPassword, 12),
        role: 'SUPER_ADMIN',
      },
      update: {},
    });
    console.info('Seed concluído. Conta inicial criada se ainda não existia.');
  } else
    console.info(
      'Seed concluído sem criar administrador. Configure ADMIN_EMAIL e ADMIN_PASSWORD para criá-lo.'
    );
}
seed()
  .catch((error) => {
    const safeMessage =
      error?.status === 422
        ? error.message
        : error?.message ===
            'ADMIN_EMAIL e ADMIN_PASSWORD devem ser informados juntos.'
          ? error.message
          : 'Não foi possível gravar os dados iniciais no PostgreSQL.';
    console.error(`Falha no seed: ${safeMessage}`);
    console.error(
      'Revise DATABASE_URL, ADMIN_EMAIL e ADMIN_NAME. A senha deve ter de 12 a 72 bytes.'
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
