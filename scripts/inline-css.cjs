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
console.log(`inline-css: ${inlined} stylesheet di-inline (${(bytes / 1024).toFixed(1)} KB), ${resourceHints.length} preload ditambahkan`);
