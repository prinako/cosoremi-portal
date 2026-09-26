const field = document.querySelector('[data-rich-content-field]');

function legacyDocument(value) {
  const escapeHtml = (text) =>
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  const blocks = value
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .filter(Boolean)
    .map((text) => ({
      type: 'paragraph',
      data: { text: escapeHtml(text.trim()).replace(/\r?\n/g, '<br>') },
    }));
  return { blocks };
}

function initialDocument(serialized, fallback) {
  if (!serialized) return legacyDocument(fallback);
  try {
    const document = JSON.parse(serialized);
    if (document.version === 1 && Array.isArray(document.blocks))
      return { blocks: document.blocks };
  } catch {
    // Invalid stored content falls back to the server-derived plain text.
  }
  return legacyDocument(fallback);
}

function applyStyleNonce(nonce) {
  const createElement = document.createElement;
  document.createElement = function createElementWithNonce(name, options) {
    const element = createElement.call(this, name, options);
    if (String(name).toLowerCase() === 'style' && nonce)
      element.setAttribute('nonce', nonce);
    return element;
  };
  return () => {
    document.createElement = createElement;
  };
}

function loadEditorModules() {
  return Promise.all([
    import('/vendor/editorjs/editorjs.mjs'),
    import('/vendor/editorjs/header.mjs'),
    import('/vendor/editorjs/list.mjs'),
    import('/vendor/editorjs/quote.mjs'),
    import('/vendor/editorjs/delimiter.mjs'),
  ]);
}

async function enhanceRichContent() {
  if (!field) return;
  const form = field.closest('form');
  const fallback = field.querySelector('textarea[name="content"]');
  const serialized = field.querySelector('input[name="contentBlocks"]');
  const holder = field.querySelector('[data-editor-holder]');
  const error = field.querySelector('[data-editor-error]');
  if (!form || !fallback || !serialized || !holder || !error) return;

  try {
    const restoreCreateElement = applyStyleNonce(
      field.dataset.editorStyleNonce
    );
    let editor;
    try {
      const [core, header, list, quote, delimiter] = await loadEditorModules();
      class SupportedList extends list.default {
        static get toolbox() {
          return super.toolbox.filter(
            (tool) => tool.data?.style !== 'checklist'
          );
        }

        renderSettings() {
          const checklistLabel = this.api.i18n.t('Checklist');
          return super
            .renderSettings()
            .filter((item) => item.label !== checklistLabel);
        }
      }
      holder.hidden = false;
      editor = new core.default({
        holder,
        style: { nonce: field.dataset.editorStyleNonce },
        data: initialDocument(serialized.value, fallback.value),
        defaultBlock: 'paragraph',
        inlineToolbar: ['bold', 'italic', 'link'],
        tools: {
          heading: {
            class: header.default,
            inlineToolbar: ['bold', 'italic', 'link'],
            config: { levels: [2, 3], defaultLevel: 2 },
          },
          list: {
            class: SupportedList,
            inlineToolbar: ['bold', 'italic', 'link'],
            config: {
              defaultStyle: 'unordered',
              maxLevel: 3,
              counterTypes: ['numeric'],
            },
          },
          quote: {
            class: quote.default,
            inlineToolbar: ['bold', 'italic', 'link'],
            config: {
              quotePlaceholder: 'Digite a citação',
              captionPlaceholder: 'Autoria opcional',
              defaultAlignment: 'left',
            },
          },
          delimiter: delimiter.default,
        },
        i18n: {
          messages: {
            toolNames: {
              Text: 'Parágrafo',
              Heading: 'Título',
              'Ordered List': 'Lista numerada',
              'Unordered List': 'Lista com marcadores',
              Quote: 'Citação',
              Delimiter: 'Divisor',
              Bold: 'Negrito',
              Italic: 'Itálico',
              Link: 'Link',
            },
            tools: {
              header: { 'Heading 2': 'Título 2', 'Heading 3': 'Título 3' },
              list: { Unordered: 'Marcadores', Ordered: 'Numerada' },
            },
            ui: {
              blockTunes: { toggler: { 'Click to tune': 'Opções do bloco' } },
              inlineToolbar: { converter: { 'Convert to': 'Converter para' } },
              toolbar: { toolbox: { Add: 'Adicionar bloco' } },
            },
          },
        },
      });
      await editor.isReady;
    } finally {
      restoreCreateElement();
    }
    fallback.required = false;
    fallback.hidden = true;
    field.dataset.enhanced = 'true';

    let submitting = false;
    form.addEventListener('submit', async (event) => {
      if (submitting) return;
      event.preventDefault();
      error.hidden = true;
      try {
        const output = await editor.save();
        serialized.value = JSON.stringify({
          version: 1,
          blocks: output.blocks.map(({ type, data }) => ({ type, data })),
        });
        serialized.disabled = false;
        submitting = true;
        form.requestSubmit(event.submitter || undefined);
      } catch {
        error.textContent =
          'Não foi possível preparar o conteúdo. Revise o editor e tente novamente.';
        error.hidden = false;
        error.focus();
      }
    });
  } catch {
    holder.hidden = true;
    error.textContent =
      'O editor visual não pôde ser carregado. Você ainda pode editar o conteúdo como texto simples.';
    error.hidden = false;
  }
}

enhanceRichContent();
