import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeContentSubmission,
  parseRichContent,
  plainTextToRichContent,
  renderRichContent,
  richContentSchema,
  richContentToPlainText,
} from '../services/rich-content.service.js';

const serialized = (...blocks) => JSON.stringify({ version: 1, blocks });
const paragraph = (text) => ({ type: 'paragraph', data: { text } });
const item = (content, items = []) => ({ content, meta: {}, items });

test('rich content renders the exact supported semantic elements', () => {
  const document = parseRichContent(
    serialized(
      paragraph(
        'Texto <b>forte</b>, <i>ênfase</i> e <a href="https://example.org/path">link</a>.'
      ),
      { type: 'heading', data: { text: 'Título dois', level: 2 } },
      { type: 'heading', data: { text: 'Título três', level: 3 } },
      {
        type: 'list',
        data: {
          style: 'unordered',
          meta: {},
          items: [item('Primeiro'), item('Segundo', [item('Aninhado')])],
        },
      },
      {
        type: 'list',
        data: {
          style: 'ordered',
          meta: { start: 2, counterType: 'numeric' },
          items: [item('Etapa')],
        },
      },
      {
        type: 'quote',
        data: { text: 'Uma citação', caption: 'Autoria', alignment: 'left' },
      },
      { type: 'delimiter', data: {} }
    )
  );

  assert.equal(
    renderRichContent(document),
    '<p>Texto <strong>forte</strong>, <em>ênfase</em> e <a href="https://example.org/path">link</a>.</p>' +
      '<h2>Título dois</h2><h3>Título três</h3>' +
      '<ul><li>Primeiro</li><li>Segundo<ul><li>Aninhado</li></ul></li></ul>' +
      '<ol start="2"><li>Etapa</li></ol>' +
      '<blockquote><p>Uma citação</p><footer>Autoria</footer></blockquote><hr>'
  );
  assert.match(
    richContentToPlainText(document),
    /Texto forte, ênfase e link\.\n\nTítulo dois/
  );
});

test('rich content rejects executable HTML, unsafe attributes and URLs', () => {
  for (const value of [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">click</a>',
    '<a href="data:text/html,bad">click</a>',
    '<iframe src="https://evil.example"></iframe>',
    '<strong onclick="alert(1)">text</strong>',
    '<svg onload="alert(1)"></svg>',
  ])
    assert.throws(() => parseRichContent(serialized(paragraph(value))), {
      status: 422,
    });

  for (const href of [
    'https://example.org',
    'http://example.org',
    'mailto:help@example.org',
    'tel:+5591999999999',
    '/contato',
    '#apoio',
  ])
    assert.doesNotThrow(() =>
      parseRichContent(serialized(paragraph(`<a href="${href}">Ajuda</a>`)))
    );
});

test('rich content schema rejects malformed structures and explicit limits', () => {
  const invalidDocuments = [
    '{',
    'null',
    JSON.stringify({ version: 2, blocks: [] }),
    serialized({ type: 'raw', data: { html: '<p>bad</p>' } }),
    serialized({ type: 'heading', data: { text: 'H1', level: 1 } }),
    serialized({ type: 'heading', data: { text: 'H4', level: 4 } }),
    serialized({ type: 'list', data: { style: 'checklist', items: [] } }),
    serialized(paragraph('x'.repeat(20001))),
    serialized(...Array.from({ length: 501 }, () => paragraph('bloco'))),
    serialized(
      paragraph('x'.repeat(20000)),
      paragraph('x'.repeat(20000)),
      paragraph('x'.repeat(20000)),
      paragraph('x'.repeat(20000)),
      paragraph('x'.repeat(20000)),
      paragraph('x')
    ),
    serialized({
      type: 'list',
      data: {
        style: 'unordered',
        meta: {},
        items: [item('1', [item('2', [item('3', [item('4')])])])],
      },
    }),
  ];
  for (const value of invalidDocuments)
    assert.throws(() => parseRichContent(value), { status: 422 });
  assert.throws(() => parseRichContent('x'.repeat(280001)), { status: 422 });

  assert.deepEqual(parseRichContent(serialized()), { version: 1, blocks: [] });
});

test('plain text conversion escapes legacy markup and preserves paragraphs', () => {
  const legacy = '<script>alert("x")</script> & texto\n\nSegundo\nlinha';
  const document = plainTextToRichContent(legacy);
  const html = renderRichContent(null, legacy);
  assert.equal(document.blocks.length, 2);
  assert.equal(
    html,
    '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; texto</p>' +
      '<p>Segundo<br>linha</p>'
  );
  assert.doesNotMatch(html, /<script>/);
});

test('content submissions derive plain text on the server and preserve fallback content safely', () => {
  const data = normalizeContentSubmission('posts', {
    content: 'client value is not trusted',
    contentBlocks: serialized(paragraph('Servidor <strong>seguro</strong>')),
  });
  assert.equal(data.content, 'Servidor seguro');
  assert.equal(data.contentBlocks.version, 1);

  const storedDocument = parseRichContent(
    serialized(
      { type: 'heading', data: { text: 'Título mantido', level: 2 } },
      paragraph('Texto <strong>rico</strong>')
    )
  );
  const existing = {
    content: 'Título mantido\n\nTexto rico',
    contentBlocks: storedDocument,
  };

  const unchangedFallback = normalizeContentSubmission(
    'work-areas',
    { content: existing.content },
    existing
  );
  assert.deepEqual(unchangedFallback.contentBlocks, storedDocument);
  assert.equal(unchangedFallback.content, existing.content);

  const editedFallback = normalizeContentSubmission(
    'work-areas',
    { content: 'Texto simples editado\n\nSegundo parágrafo' },
    existing
  );
  assert.deepEqual(editedFallback.contentBlocks, {
    version: 1,
    blocks: [
      paragraph('Texto simples editado'),
      paragraph('Segundo parágrafo'),
    ],
  });
  assert.equal(
    editedFallback.content,
    'Texto simples editado\n\nSegundo parágrafo'
  );

  const newFallback = normalizeContentSubmission('work-areas', {
    content: 'Texto simples',
  });
  assert.deepEqual(newFallback.contentBlocks, {
    version: 1,
    blocks: [paragraph('Texto simples')],
  });
  assert.equal(newFallback.content, 'Texto simples');

  assert.throws(() => normalizeContentSubmission('posts', { content: '' }), {
    status: 422,
  });
  assert.deepEqual(
    normalizeContentSubmission('gallery', { description: 'simples' }),
    { description: 'simples' }
  );
  assert.equal(
    richContentSchema.safeParse({ version: 1, blocks: [] }).success,
    true
  );
});
