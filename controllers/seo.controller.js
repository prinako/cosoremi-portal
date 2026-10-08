import { published } from '../services/content.service.js';
import { absoluteUrl, pagePath, sitemapXml } from '../services/seo.service.js';

export const robots = (req, res) => {
  const sitemap = absoluteUrl(req.app.locals.env.appUrl, '/sitemap.xml');
  res.type('text/plain; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(`User-agent: *\nAllow: /\nDisallow: /health\nSitemap: ${sitemap}\n`);
};

export const sitemap = async (req, res) => {
  const db = req.app.locals.db;
  const [pages, posts, areas] = await Promise.all([
    db.page.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    }),
    db.post.findMany({
      where: published(),
      select: { slug: true, updatedAt: true },
    }),
    db.workArea.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);
  const appUrl = req.app.locals.env.appUrl;
  const pageEntries = pages.map((page) => ({
    loc: absoluteUrl(appUrl, pagePath(page.slug)),
    lastmod: page.updatedAt,
  }));
  const entries = [
    ...pageEntries,
    ...['/blog', '/linhas-de-trabalho', '/galeria'].map((pathname) => ({
      loc: absoluteUrl(appUrl, pathname),
    })),
    ...posts.map((post) => ({
      loc: absoluteUrl(appUrl, `/blog/${encodeURIComponent(post.slug)}`),
      lastmod: post.updatedAt,
    })),
    ...areas.map((area) => ({
      loc: absoluteUrl(
        appUrl,
        `/linhas-de-trabalho/${encodeURIComponent(area.slug)}`
      ),
      lastmod: area.updatedAt,
    })),
  ];
  const unique = [
    ...new Map(entries.map((entry) => [entry.loc, entry])).values(),
  ];
  res.type('application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(sitemapXml(unique));
};
