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

// ── Konten statis untuk crawler ───────────────────────────────
// Body hasil build hanya berisi <div id="root"></div>, jadi crawler yang tidak
// menjalankan JS (sebagian Bing, crawler AI, dsb.) tidak melihat apa pun. Blok di
// bawah menaruh isi yang bisa dibaca langsung dari HTML. createRoot() menghapus
// seluruh anak #root saat mount, jadi React tetap jadi sumber kebenaran di browser
// dan tidak ada duplikasi konten.
//
// Semua gaya ditulis inline: script ini bukan sumber yang dipindai Tailwind, jadi
// class utility belum tentu ada di CSS hasil build.
const ROOT_PLACEHOLDER = '<div id="root"></div>';

const S = {
  main:  'margin:0 auto;max-width:64rem;padding:2rem 1rem;font-family:Inter,system-ui,sans-serif',
  crumb: 'font-size:.875rem;opacity:.7;margin-bottom:1rem',
  h1:    'font-size:1.75rem;line-height:1.25;font-weight:700;margin:0 0 .25rem',
  alt:   'font-size:1rem;opacity:.7;margin:0 0 1rem',
  h2:    'font-size:1.25rem;font-weight:700;margin:2rem 0 .5rem',
  cover: 'width:100%;max-width:20rem;height:auto;border-radius:.75rem',
  dl:    'display:grid;grid-template-columns:auto 1fr;gap:.25rem 1rem;font-size:.9375rem;margin:0',
  dt:    'opacity:.7',
  list:  'list-style:none;padding:0;margin:0;font-size:.9375rem',
  li:    'padding:.375rem 0;border-bottom:1px solid rgba(127,127,127,.25)',
  link:  'color:inherit',
};

function jsonLd(data) {
  // </script> dan karakter HTML di-escape supaya payload tidak bisa menutup tag.
  const payload = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${payload}</script>`;
}

function definitionRow(term, value) {
  if (!value) return '';
  return `<dt style="${S.dt}">${escapeText(term)}</dt><dd style="margin:0">${escapeText(value)}</dd>`;
}

// Detail satu manga — HANYA informasi umum (judul, sinopsis, kredit, genre).
// Daftar chapter, nomor chapter terakhir, dan jumlah chapter sengaja TIDAK
// dimasukkan: crawler cukup sampai halaman detail, dan angka chapter cepat basi
// sehingga snippet hasil pencarian gampang salah. Info itu tetap tampil normal
// di browser karena React yang merendernya.
function mangaSeoBody(manga, detail, canonical, siteUrl) {
  const covers = manga.coverUrls || {};
  const desktopCover = covers.desktop || manga.coverUrl || '';
  const genres = (manga.genres || []).filter(Boolean);

  const sources = [
    covers.mobile && `<source media="(max-width: 639px)" srcset="${escapeAttribute(covers.mobile)}">`,
    covers.tablet && `<source media="(max-width: 1023px)" srcset="${escapeAttribute(covers.tablet)}">`,
  ].filter(Boolean).join('');
  // URL persis sama dengan <link rel=preload> di head, jadi tidak ada request
  // tambahan — cover justru tampil sebelum React mount (LCP lebih cepat).
  const cover = desktopCover
    ? `<picture>${sources}<img src="${escapeAttribute(desktopCover)}" alt="Sampul ${escapeAttribute(manga.title)}" style="${S.cover}" fetchpriority="high"></picture>`
    : '';

  const facts = [
    definitionRow('Penulis', detail?.author),
    definitionRow('Artis', detail?.artist),
    definitionRow('Status', manga.status),
    definitionRow('Tipe', detail?.type),
    definitionRow('Genre', genres.join(', ')),
  ].join('');

  const structured = [
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Beranda', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: manga.title, item: canonical },
      ],
    }),
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'CreativeWorkSeries',
      name: manga.title,
      ...(detail?.alt_title ? { alternateName: detail.alt_title } : {}),
      url: canonical,
      ...(desktopCover ? { image: desktopCover } : {}),
      ...(manga.description ? { description: String(manga.description).trim() } : {}),
      ...(genres.length ? { genre: genres } : {}),
      ...(detail?.author ? { author: { '@type': 'Person', name: detail.author } } : {}),
      ...(detail?.artist ? { creator: { '@type': 'Person', name: detail.artist } } : {}),
      inLanguage: 'id',
    }),
  ].join('');

  return `<div id="root"><main id="seo-static" style="${S.main}">`
    + `<nav aria-label="Breadcrumb" style="${S.crumb}"><a href="/" style="${S.link}">Beranda</a> / ${escapeText(manga.title)}</nav>`
    + '<article>'
    + cover
    + `<h1 style="${S.h1}">${escapeText(manga.title)}</h1>`
    + (detail?.alt_title ? `<p style="${S.alt}">${escapeText(detail.alt_title)}</p>` : '')
    + (facts ? `<dl style="${S.dl}">${facts}</dl>` : '')
    + `<h2 style="${S.h2}">Sinopsis</h2><p>${escapeText(String(manga.description || '').trim())}</p>`
    + '</article></main>'
    + structured
    + '</div>';
}

// Beranda: daftar tautan ke tiap halaman detail supaya crawler punya jalur
// penemuan selain sitemap. Sengaja tanpa <img> — cover homepage sudah di-preload
// untuk carousel, menambah <img> di sini hanya menggandakan unduhan.
function homeSeoBody(catalog, siteUrl) {
  const items = catalog
    .filter((manga) => manga?.id && manga?.title)
    .map((manga) => (
      `<li style="${S.li}"><a href="/${encodeURIComponent(manga.id)}/" style="${S.link}">${escapeText(manga.title)}</a>`
      + (manga.status ? ` <span style="${S.dt}">— ${escapeText(manga.status)}</span>` : '')
      + '</li>'
    ))
    .join('');

  const structured = [
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Nurananto Scanlation',
      url: `${siteUrl}/`,
      inLanguage: 'id',
    }),
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: catalog
        .filter((manga) => manga?.id && manga?.title)
        .map((manga, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: manga.title,
          url: `${siteUrl}/${encodeURIComponent(manga.id)}/`,
        })),
    }),
  ].join('');

  return `<div id="root"><main id="seo-static" style="${S.main}">`
    + '<h1 style="' + S.h1 + '">Nurananto Scanlation</h1>'
    + '<p style="' + S.alt + '">Manga terjemahan Indonesia.</p>'
    + `<h2 style="${S.h2}">Daftar Manga</h2><ul style="${S.list}">${items}</ul>`
    + '</main>'
    + structured
    + '</div>';
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
    // Trailing slash mengikuti URL yang benar-benar disajikan Pages
    // (dist/<id>/index.html); "/<id>" hanya 308 ke "/<id>/".
    const canonical = `${siteUrl}/${encodeURIComponent(manga.id)}/`;
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

    const detailPath = path.join('public', 'manga', `${manga.id}.json`);
    let detail = null;
    if (fs.existsSync(detailPath)) {
      try {
        detail = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
      } catch (error) {
        console.warn(`inline-css: ${manga.id}.json tidak terbaca (${error.message})`);
      }
    }
    routeHtml = routeHtml.replace(ROOT_PLACEHOLDER, mangaSeoBody(manga, detail, canonical, siteUrl));

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

// Route manga diturunkan dari `html` yang #root-nya MASIH kosong, supaya tiap
// route bisa menyisipkan blok statis miliknya sendiri.
const mangaRoutes = writeMangaRouteHtml(html);

const catalogPath = path.join('public', 'manga', 'index.json');
let homeCatalog = [];
if (fs.existsSync(catalogPath)) {
  try {
    homeCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (error) {
    console.warn(`inline-css: katalog beranda tidak terbaca (${error.message})`);
  }
}
if (Array.isArray(homeCatalog) && homeCatalog.length) {
  const siteUrl = (process.env.SITE_URL || 'https://nuranantoscans.my.id').replace(/\/$/, '');
  html = html.replace(ROOT_PLACEHOLDER, homeSeoBody(homeCatalog, siteUrl));
}

fs.writeFileSync(htmlPath, html);
console.log(`inline-css: ${inlined} stylesheet di-inline (${(bytes / 1024).toFixed(1)} KB), ${resourceHints.length} preload ditambahkan, ${mangaRoutes} route manga dibuat`);
