// Inline CSS hasil build supaya homepage tidak menunggu stylesheet terpisah.
// Sekaligus masukkan preload gambar LCP responsif dan dua font kritis ke awal head.
const fs = require('fs');
const path = require('path');

const dist = 'dist';
const htmlPath = path.join(dist, 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.warn('inline-css: dist/index.html tidak ada, dilewati');
  process.exit(0);
}

let html = fs.readFileSync(htmlPath, 'utf8');
let inlined = 0;
let bytes = 0;
const criticalFonts = [];

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceMeta(documentHtml, attribute, key, content) {
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${key}["'][^>]*>`, 'i');
  const tag = `<meta ${attribute}="${escapeAttribute(key)}" content="${escapeAttribute(content)}" />`;
  return pattern.test(documentHtml)
    ? documentHtml.replace(pattern, tag)
    : documentHtml.replace('</head>', `  ${tag}\n  </head>`);
}

function writeMangaRouteHtml(rootHtml) {
  const catalogPath = path.join('public', 'manga', 'index.json');
  if (!fs.existsSync(catalogPath)) return 0;
  const siteUrl = (process.env.SITE_URL || 'https://nuranantoscans.my.id').replace(/\/$/, '');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  let written = 0;

  for (const manga of catalog) {
    if (!manga?.id || !/^[A-Za-z0-9._-]+$/.test(manga.id)) continue;
    const title = `${manga.title} | Nurananto Scanlation`;
    const rawDescription = String(manga.description || 'Baca manga terjemahan Indonesia di Nurananto Scanlation.').trim();
    const description = rawDescription.length > 160
      ? `${rawDescription.slice(0, 160).replace(/\s+\S*$/, '')}…`
      : rawDescription;
    const canonical = `${siteUrl}/${encodeURIComponent(manga.id)}`;
    const covers = manga.coverUrls || {};
    const desktopCover = covers.desktop || manga.coverUrl || `${siteUrl}/logo-header.webp`;
    const routeDir = path.join(dist, manga.id);
    let routeHtml = rootHtml
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeText(title)}</title>`)
      .replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeAttribute(canonical)}" />`)
      .replace(/<link\s+rel=["']preload["']\s+as=["']image["'][^>]*>\s*/gi, '')
      .replace(/<script>window\.__INLINE_MANGA_INDEX__=[\s\S]*?<\/script>/i, '');

    routeHtml = replaceMeta(routeHtml, 'name', 'description', description);
    routeHtml = replaceMeta(routeHtml, 'name', 'robots', 'index, follow');
    routeHtml = replaceMeta(routeHtml, 'property', 'og:type', 'article');
    routeHtml = replaceMeta(routeHtml, 'property', 'og:title', title);
    routeHtml = replaceMeta(routeHtml, 'property', 'og:description', description);
    routeHtml = replaceMeta(routeHtml, 'property', 'og:url', canonical);
    routeHtml = replaceMeta(routeHtml, 'property', 'og:image', desktopCover);
    routeHtml = replaceMeta(routeHtml, 'name', 'twitter:card', 'summary_large_image');
    routeHtml = replaceMeta(routeHtml, 'name', 'twitter:title', title);
    routeHtml = replaceMeta(routeHtml, 'name', 'twitter:description', description);
    routeHtml = replaceMeta(routeHtml, 'name', 'twitter:image', desktopCover);

    const coverHints = [
      { href: covers.mobile || desktopCover, media: '(max-width: 639px)' },
      { href: covers.tablet || desktopCover, media: '(min-width: 640px) and (max-width: 1023px)' },
      { href: desktopCover, media: '(min-width: 1024px)' },
    ].map(({ href, media }) => (
      `<link rel="preload" as="image" href="${escapeAttribute(href)}" media="${escapeAttribute(media)}" fetchpriority="high">`
    ));
    routeHtml = routeHtml.replace('</head>', `  ${coverHints.join('\n  ')}\n  </head>`);
    fs.mkdirSync(routeDir, { recursive: true });
    fs.writeFileSync(path.join(routeDir, 'index.html'), routeHtml);
    written += 1;
  }
  return written;
}

function collectCriticalFonts(css) {
  const rules = css.match(/@font-face\s*\{[^}]*\}/g) || [];
  const wanted = [
    { family: 'Inter', weight: '400' },
    { family: 'Hanken Grotesk', weight: '700' },
  ];

  for (const target of wanted) {
    const rule = rules.find((candidate) => (
      candidate.includes(`font-family:${target.family}`) ||
      candidate.includes(`font-family:"${target.family}"`) ||
      candidate.includes(`font-family:'${target.family}'`)
    ) && candidate.includes(`font-weight:${target.weight}`));
    const match = rule?.match(/url\((?:"|')?([^)'\"]+\.woff2)(?:"|')?\)/);
    if (match && !criticalFonts.includes(match[1])) criticalFonts.push(match[1]);
  }
}

function getReleaseTime(manga) {
  const direct = Date.parse(manga?.latest_release_date || '');
  if (Number.isFinite(direct)) return direct;
  return (manga?.chapters || []).reduce((latest, chapter) => {
    const value = Date.parse(chapter?.release_date || '');
    return Number.isFinite(value) ? Math.max(latest, value) : latest;
  }, 0);
}

function imagePreloads() {
  const catalogPath = path.join('public', 'manga', 'index.json');
  if (!fs.existsSync(catalogPath)) return [];

  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    if (!Array.isArray(catalog) || catalog.length === 0) return [];

    let activeIndex = 0;
    let latest = 0;
    catalog.forEach((manga, index) => {
      const releasedAt = getReleaseTime(manga);
      if (releasedAt > latest) {
        latest = releasedAt;
        activeIndex = index;
      }
    });

    const targets = [
      { manga: catalog[activeIndex], priority: 'high' },
      { manga: catalog[(activeIndex + 1) % catalog.length], priority: 'low' },
    ];
    const breakpoints = [
      { key: 'mobile', media: '(max-width: 639px)' },
      { key: 'tablet', media: '(min-width: 640px) and (max-width: 1023px)' },
      { key: 'desktop', media: '(min-width: 1024px)' },
    ];

    return targets.flatMap(({ manga, priority }) => {
      const covers = manga?.coverUrls || {};
      const fallback = covers.desktop || manga?.coverUrl;
      return breakpoints.map(({ key, media }) => ({
        href: covers[key] || fallback,
        media,
        priority,
      })).filter(({ href }) => Boolean(href));
    });
  } catch (error) {
    console.warn(`inline-css: gagal membaca katalog untuk preload LCP (${error.message})`);
    return [];
  }
}

function inlineHomepageCatalog() {
  const catalogPath = path.join('public', 'manga', 'index.json');
  if (!fs.existsSync(catalogPath)) return;

  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const serialized = JSON.stringify(catalog)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
    html = html.replace(
      '<!-- HOMEPAGE_CATALOG -->',
      `<script>window.__INLINE_MANGA_INDEX__=${serialized}</script>`,
    );
  } catch (error) {
    console.warn(`inline-css: gagal menyisipkan katalog homepage (${error.message})`);
  }
}

html = html.replace(/<link\b[^>]*>/g, (tag) => {
  if (!/rel=["']stylesheet["']/.test(tag)) return tag;
  const match = tag.match(/href=["']([^"']+)["']/);
  if (!match || /^https?:/i.test(match[1])) return tag;
  const cssPath = path.join(dist, match[1].replace(/^\//, ''));
  if (!fs.existsSync(cssPath)) return tag;

  const css = fs.readFileSync(cssPath, 'utf8');
  collectCriticalFonts(css);
  inlined += 1;
  bytes += Buffer.byteLength(css);
  return `<style>${css}</style>`;
});

inlineHomepageCatalog();

const resourceHints = [
  ...imagePreloads().map(({ href, media, priority }) => (
    `<link rel="preload" as="image" href="${escapeAttribute(href)}" media="${escapeAttribute(media)}" fetchpriority="${priority}">`
  )),
  ...criticalFonts.map((href) => (
    `<link rel="preload" as="font" type="font/woff2" href="${escapeAttribute(href)}" crossorigin>`
  )),
];

if (resourceHints.length) {
  html = html.replace('<head>', `<head>\n    ${resourceHints.join('\n    ')}`);
}

fs.writeFileSync(htmlPath, html);
const mangaRoutes = writeMangaRouteHtml(html);
console.log(`inline-css: ${inlined} stylesheet di-inline (${(bytes / 1024).toFixed(1)} KB), ${resourceHints.length} preload ditambahkan, ${mangaRoutes} route manga dibuat`);
