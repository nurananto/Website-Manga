// Inline seluruh CSS hasil build ke <head> index.html, lalu hapus <link stylesheet>.
// Untuk SPA, "critical CSS" tak bisa diekstrak (HTML awal hanya <div id="root"> kosong),
// jadi seluruh CSS di-inline supaya tidak ada request CSS render-blocking di critical path.
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

html = html.replace(/<link\b[^>]*>/g, (tag) => {
  if (!/rel=["']stylesheet["']/.test(tag)) return tag;          // hanya stylesheet
  const m = tag.match(/href=["']([^"']+)["']/);
  if (!m || /^https?:/i.test(m[1])) return tag;                 // hanya file lokal
  const cssPath = path.join(dist, m[1].replace(/^\//, ''));
  if (!fs.existsSync(cssPath)) return tag;
  const css = fs.readFileSync(cssPath, 'utf8');
  inlined++; bytes += Buffer.byteLength(css);
  return `<style>${css}</style>`;
});

fs.writeFileSync(htmlPath, html);
console.log(`inline-css: ${inlined} stylesheet di-inline (${(bytes / 1024).toFixed(1)} KB) → index.html`);
