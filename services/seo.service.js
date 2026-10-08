export const reservedPageRoutes = Object.freeze({
  inicio: '/',
  'sobre-nos': '/sobre-nos',
  doar: '/doar',
  emergencia: '/emergencia',
  contato: '/contato',
});

export function absoluteUrl(appUrl, pathname = '/') {
  return new URL(pathname, appUrl).href;
}

export function publicMediaUrl(appUrl, value) {
  if (!value) return '';
  const url = new URL(value, appUrl);
  return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
}

export function listingUrl(appUrl, pathname, page = 1) {
  const url = new URL(pathname, appUrl);
  if (page > 1) url.searchParams.set('page', String(page));
  return url.href;
}

export function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function sitemapXml(entries) {
  const urls = entries
    .map(({ loc, lastmod }) => {
      const modified = lastmod
        ? `\n    <lastmod>${xmlEscape(new Date(lastmod).toISOString())}</lastmod>`
        : '';
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${modified}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function safeJsonLd(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function validHttpsUrls(values) {
  return values.filter((value) => {
    if (!value) return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  });
}

export function siteStructuredData(settings, appUrl) {
  const siteName = settings.site_name || 'COSOREMI';
  const organization = {
    '@type': 'Organization',
    '@id': absoluteUrl(appUrl, '/#organization'),
    name: siteName,
    url: absoluteUrl(appUrl, '/'),
  };
  const logo = publicMediaUrl(appUrl, settings.site_logo);
  if (logo) organization.logo = logo;
  if (settings.institutional_email)
    organization.email = settings.institutional_email;
  if (settings.phone) organization.telephone = settings.phone;
  const sameAs = validHttpsUrls([
    settings.facebook,
    settings.instagram,
    settings.youtube,
  ]);
  if (sameAs.length) organization.sameAs = sameAs;

  const website = {
    '@type': 'WebSite',
    '@id': absoluteUrl(appUrl, '/#website'),
    name: siteName,
    url: absoluteUrl(appUrl, '/'),
    publisher: { '@id': organization['@id'] },
  };
  if (settings.site_description)
    website.description = settings.site_description;

  return {
    '@context': 'https://schema.org',
    '@graph': [organization, website],
  };
}

export function blogPostingStructuredData(item, metadata, settings, appUrl) {
  const organizationId = absoluteUrl(appUrl, '/#organization');
  const article = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: item.title,
    description: metadata.pageDescription,
    datePublished: item.publishedAt.toISOString(),
    dateModified: item.updatedAt.toISOString(),
    mainEntityOfPage: metadata.canonicalUrl,
    author: { '@type': 'Person', name: item.author.name },
    publisher: {
      '@type': 'Organization',
      '@id': organizationId,
      name: settings.site_name || 'COSOREMI',
      url: absoluteUrl(appUrl, '/'),
    },
  };
  if (metadata.image) article.image = metadata.image;
  const logo = publicMediaUrl(appUrl, settings.site_logo);
  if (logo) article.publisher.logo = { '@type': 'ImageObject', url: logo };
  return article;
}

export function pagePath(slug) {
  return reservedPageRoutes[slug] || `/paginas/${encodeURIComponent(slug)}`;
}
