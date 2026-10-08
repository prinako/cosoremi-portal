export function contentPath(resource, slug, reservedPageRoutes = {}) {
  const safeSlug = slug || 'endereco';
  if (resource === 'pages')
    return (
      reservedPageRoutes[safeSlug] || `/paginas/${encodeURIComponent(safeSlug)}`
    );
  if (resource === 'posts') return `/blog/${encodeURIComponent(safeSlug)}`;
  if (resource === 'work-areas')
    return `/linhas-de-trabalho/${encodeURIComponent(safeSlug)}`;
  return '/';
}

export function previewTitle(seoTitle, contentTitle, siteName) {
  return (
    seoTitle.trim() ||
    `${contentTitle.trim() || 'Título do conteúdo'} | ${siteName}`
  );
}

export function previewDescription(
  seoDescription,
  contentDescription,
  siteDescription
) {
  return (
    seoDescription.trim() || contentDescription.trim() || siteDescription.trim()
  );
}

function enhanceSeoControls(root) {
  const title = root.querySelector('[data-seo-title]');
  const description = root.querySelector('[data-seo-description]');
  const contentTitle = document.querySelector('[name="title"]');
  const slug = document.querySelector('[name="slug"]');
  const descriptionSource = document.querySelector(
    root.dataset.resource === 'pages' ? '[name="subtitle"]' : '[name="summary"]'
  );
  const titleOutput = root.querySelector('[data-preview-title]');
  const urlOutput = root.querySelector('[data-preview-url]');
  const descriptionOutput = root.querySelector('[data-preview-description]');
  const titleCount = root.querySelector('[data-character-count="seoTitle"]');
  const descriptionCount = root.querySelector(
    '[data-character-count="seoDescription"]'
  );
  const reservedPageRoutes = JSON.parse(
    root.dataset.reservedPageRoutes || '{}'
  );

  const update = () => {
    titleCount.textContent = `${title.value.length} / ${title.maxLength}`;
    descriptionCount.textContent = `${description.value.length} / ${description.maxLength}`;
    titleOutput.textContent = previewTitle(
      title.value,
      contentTitle?.value || '',
      root.dataset.siteName
    );
    descriptionOutput.textContent = previewDescription(
      description.value,
      descriptionSource?.value || '',
      root.dataset.siteDescription || ''
    );
    urlOutput.textContent = new URL(
      contentPath(root.dataset.resource, slug?.value || '', reservedPageRoutes),
      root.dataset.appUrl
    ).href;
  };

  for (const control of [
    title,
    description,
    contentTitle,
    descriptionSource,
    slug,
  ])
    control?.addEventListener('input', () => queueMicrotask(update));
  update();
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-seo-controls]');
  if (root) enhanceSeoControls(root);
}
