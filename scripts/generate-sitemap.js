import fs from 'fs';
import path from 'path';

const SITE_URL = (process.env.SITE_URL || 'https://nuranantoscans.my.id').replace(/\/$/, '');
const catalogPath = path.join('public', 'manga', 'index.json');
const sitemapPath = path.join('public', 'sitemap.xml');

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function segment(value) {
  return encodeURIComponent(String(value));
}

function latestDate(values) {
  const latest = values
    .map(value => new Date(value).getTime())
    .filter(time => !Number.isNaN(time))
    .sort((a, b) => b - a)[0];

  return latest ? new Date(latest).toISOString().slice(0, 10) : null;
}

function urlEntry(loc, { lastmod, changefreq, priority } = {}) {
  const lines = ['  <url>', `    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) lines.push(`    <lastmod>${xmlEscape(lastmod)}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${xmlEscape(changefreq)}</changefreq>`);
  if (priority) lines.push(`    <priority>${xmlEscape(priority)}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
}

if (!fs.existsSync(catalogPath)) {
  console.error(`generate-sitemap: ${catalogPath} tidak ditemukan`);
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const urls = [];
const allReleaseDates = catalog.flatMap(manga => (manga.chapters || []).map(chapter => chapter.release_date));

urls.push(urlEntry(`${SITE_URL}/`, {
  lastmod: latestDate(allReleaseDates),
  changefreq: 'daily',
  priority: '1.0',
}));

for (const manga of catalog) {
  const chapters = manga.chapters || [];
  const mangaLastmod = latestDate(chapters.map(chapter => chapter.release_date));

  urls.push(urlEntry(`${SITE_URL}/${segment(manga.id)}`, {
    lastmod: mangaLastmod,
    changefreq: manga.status === 'Ongoing' ? 'daily' : 'weekly',
    priority: '0.8',
  }));
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls,
  '</urlset>',
  '',
].join('\n');

fs.writeFileSync(sitemapPath, xml, 'utf8');
console.log(`generate-sitemap: ${urls.length} URL ditulis ke ${sitemapPath}`);
