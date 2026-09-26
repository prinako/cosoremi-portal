import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { httpError } from '../utils/http.js';

export const RICH_CONTENT_VERSION = 1;
export const RICH_CONTENT_LIMITS = Object.freeze({
  blocks: 500,
  blockText: 20000,
  listDepth: 3,
  listItems: 500,
  plainText: 100000,
  serialized: 280000,
});

const inlineTags = new Set(['strong', 'b', 'em', 'i', 'a', 'br']);
const allowedProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function safeHref(value) {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) return null;
  if (
    (href.startsWith('/') && !href.startsWith('//')) ||
    href.startsWith('#') ||
    href.startsWith('?')
  )
    return href;
  try {
    const url = new URL(href);
    return allowedProtocols.has(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

function sanitizeInline(value) {
  let violation = '';
  const cleaned = sanitizeHtml(value, {
    allowedTags: [...inlineTags],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: [...allowedProtocols].map((protocol) =>
      protocol.slice(0, -1)
    ),
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      b: 'strong',
      i: 'em',
      a: (tagName, attributes) => {
        const href = safeHref(attributes.href);
        if (!href) violation ||= 'Link com endereço inválido.';
        return { tagName, attribs: href ? { href } : {} };
      },
    },
    onOpenTag(tagName, attributes) {
      if (!inlineTags.has(tagName)) {
        violation ||= `Elemento inline não permitido: ${tagName}.`;
        return;
      }
      const allowed = tagName === 'a' ? new Set(['href']) : new Set();
      if (Object.keys(attributes).some((attribute) => !allowed.has(attribute)))
        violation ||= `Atributo inline não permitido em ${tagName}.`;
    },
  });
  if (violation) throw new Error(violation);
  return cleaned.trim();
}

const inlineText = z
  .string()
  .max(RICH_CONTENT_LIMITS.blockText)
  .transform((value, context) => {
    try {
      return sanitizeInline(value);
    } catch (error) {
      context.addIssue({ code: 'custom', message: error.message });
      return z.NEVER;
    }
  });

const listItem = z.lazy(() =>
  z
    .object({
      content: inlineText,
      meta: z.object({}).strict().default({}),
      items: z.array(listItem).default([]),
    })
    .strict()
);

const paragraph = z
  .object({
    type: z.literal('paragraph'),
    data: z.object({ text: inlineText }).strict(),
  })
  .strict();
const heading = z
  .object({
    type: z.literal('heading'),
    data: z
      .object({
        text: inlineText,
        level: z.union([z.literal(2), z.literal(3)]),
      })
      .strict(),
  })
  .strict();
const list = z
  .object({
    type: z.literal('list'),
    data: z
      .object({
        style: z.enum(['ordered', 'unordered']),
        meta: z
          .object({
            start: z.number().int().min(1).max(1000).optional(),
            counterType: z.literal('numeric').optional(),
          })
          .strict()
          .default({}),
        items: z.array(listItem).min(1),
      })
      .strict(),
  })
  .strict();
const quote = z
  .object({
    type: z.literal('quote'),
    data: z
      .object({
        text: inlineText,
        caption: inlineText.pipe(z.string().max(500)).default(''),
        alignment: z.enum(['left', 'center']).default('left'),
      })
      .strict(),
  })
  .strict();
const delimiter = z
  .object({ type: z.literal('delimiter'), data: z.object({}).strict() })
  .strict();

export const richContentSchema = z
  .object({
    version: z.literal(RICH_CONTENT_VERSION),
    blocks: z
      .array(
        z.discriminatedUnion('type', [
          paragraph,
          heading,
          list,
          quote,
          delimiter,
        ])
      )
      .max(RICH_CONTENT_LIMITS.blocks),
  })
  .strict()
  .superRefine((document, context) => {
    let itemCount = 0;
    let tooDeep = false;
    const visit = (items, depth) => {
      if (depth > RICH_CONTENT_LIMITS.listDepth) tooDeep = true;
      for (const item of items) {
        itemCount += 1;
        visit(item.items, depth + 1);
      }
    };
    for (const block of document.blocks)
      if (block.type === 'list') visit(block.data.items, 1);
    if (tooDeep)
      context.addIssue({
        code: 'custom',
        message: `Listas aceitam até ${RICH_CONTENT_LIMITS.listDepth} níveis.`,
      });
    if (itemCount > RICH_CONTENT_LIMITS.listItems)
      context.addIssue({
        code: 'custom',
        message: `Limite de ${RICH_CONTENT_LIMITS.listItems} itens de lista.`,
      });
  });

function richContentError(issues) {
  return httpError(
    422,
    `Conteúdo estruturado inválido. ${issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(' ')}`
  );
}

export function parseRichContent(value) {
  if (typeof value !== 'string')
    throw httpError(422, 'Conteúdo estruturado inválido.');
  if (Buffer.byteLength(value, 'utf8') > RICH_CONTENT_LIMITS.serialized)
    throw httpError(422, 'Conteúdo estruturado excede o limite permitido.');
  let input;
  try {
    input = JSON.parse(value);
  } catch {
    throw httpError(422, 'Conteúdo estruturado contém JSON inválido.');
  }
  const result = richContentSchema.safeParse(input);
  if (!result.success) throw richContentError(result.error.issues);
  const plainText = richContentToPlainText(result.data);
  if (plainText.length > RICH_CONTENT_LIMITS.plainText)
    throw httpError(422, 'Conteúdo excede o limite de 100000 caracteres.');
  return result.data;
}

function inlineToPlainText(value) {
  return sanitizeHtml(value.replace(/<br\s*\/?>/gi, '\n'), {
    allowedTags: [],
    allowedAttributes: {},
  });
}

function listItemsToPlainText(items, depth = 0) {
  return items.flatMap((item) => [
    `${'  '.repeat(depth)}${inlineToPlainText(item.content)}`,
    ...listItemsToPlainText(item.items, depth + 1),
  ]);
}

export function richContentToPlainText(document) {
  const parts = document.blocks.flatMap((block) => {
    if (block.type === 'delimiter') return [''];
    if (block.type === 'list') return listItemsToPlainText(block.data.items);
    if (block.type === 'quote')
      return [
        inlineToPlainText(block.data.text),
        inlineToPlainText(block.data.caption),
      ];
    return [inlineToPlainText(block.data.text)];
  });
  return parts
    .map((part) => part.trim())
    .filter((part, index, all) => part || (index > 0 && all[index - 1]))
    .join('\n\n')
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function plainTextToRichContent(content = '') {
  const blocks = String(content)
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .filter(Boolean)
    .map((text) => ({
      type: 'paragraph',
      data: { text: escapeHtml(text.trim()).replace(/\r?\n/g, '<br>') },
    }));
  return { version: RICH_CONTENT_VERSION, blocks };
}

function renderListItems(items, tag) {
  return items
    .map((item) => {
      const nested = item.items.length
        ? `<${tag}>${renderListItems(item.items, tag)}</${tag}>`
        : '';
      return `<li>${item.content}${nested}</li>`;
    })
    .join('');
}

function renderDocument(document) {
  return document.blocks
    .map((block) => {
      if (block.type === 'paragraph') return `<p>${block.data.text}</p>`;
      if (block.type === 'heading')
        return `<h${block.data.level}>${block.data.text}</h${block.data.level}>`;
      if (block.type === 'delimiter') return '<hr>';
      if (block.type === 'quote') {
        const caption = block.data.caption
          ? `<footer>${block.data.caption}</footer>`
          : '';
        return `<blockquote><p>${block.data.text}</p>${caption}</blockquote>`;
      }
      const tag = block.data.style === 'ordered' ? 'ol' : 'ul';
      const start =
        tag === 'ol' && block.data.meta.start > 1
          ? ` start="${block.data.meta.start}"`
          : '';
      return `<${tag}${start}>${renderListItems(block.data.items, tag)}</${tag}>`;
    })
    .join('');
}

export function renderRichContent(document, legacyContent = '') {
  if (document != null) {
    const result = richContentSchema.safeParse(document);
    if (result.success) return renderDocument(result.data);
  }
  return renderDocument(plainTextToRichContent(legacyContent));
}

function fallbackDocument(data, existing) {
  if (existing?.contentBlocks != null && data.content === existing.content) {
    const stored = richContentSchema.safeParse(existing.contentBlocks);
    if (stored.success) return stored.data;
  }
  return plainTextToRichContent(data.content);
}

export function normalizeContentSubmission(resource, data, existing = null) {
  if (!['pages', 'posts', 'work-areas'].includes(resource)) return data;
  const document =
    data.contentBlocks === undefined
      ? fallbackDocument(data, existing)
      : parseRichContent(data.contentBlocks);
  delete data.contentBlocks;
  data.content = richContentToPlainText(document);
  if (resource !== 'pages' && !data.content)
    throw httpError(422, 'Conteúdo: Use ao menos 1 caractere.');
  data.contentBlocks = document;
  return data;
}
