#!/usr/bin/env node
/**
 * check-locked-leak.js — deteksi chapter TERKUNCI yang bocor ke bucket publik.
 *
 * Model keamanan: chapter terkunci HARUS hanya ada di bucket privat
 * (manga-locked), TIDAK boleh ada di bucket publik (manga-media / CDN).
 * Script ini membaca semua chapter yang masih terkunci dari katalog lalu
 * HEAD ke CDN publik:
 *   - 404  → ✅ aman (gambar tidak ada di bucket publik)
 *   - 200  → ❌ BOCOR (gambar locked bisa diakses gratis tanpa token)
 *
 * Jalankan SETELAH upload manual ke R2:
 *   node scripts/check-locked-leak.js
 *   node scripts/check-locked-leak.js --all-pages   # cek semua halaman, bukan cuma page 1
 *
 * Env opsional: CDN_BASE (default: diambil dari coverUrl katalog).
 * Exit code 1 kalau ada kebocoran (bisa dipakai untuk gating CI/deploy).
 */

import fs from 'fs';
import path from 'path';

const MANGA_DIR  = './public/manga';
const ALL_PAGES  = process.argv.includes('--all-pages');

// Tentukan CDN base: env → host dari coverUrl pertama → fallback hardcoded.
function resolveCdnBase(catalog) {
  if (process.env.CDN_BASE) return process.env.CDN_BASE.replace(/\/$/, '');
  for (const m of catalog) {
    const url = m.coverUrls?.desktop || m.coverUrl;
    if (typeof url === 'string' && url.startsWith('http')) {
      try { return new URL(url).origin; } catch { /* lanjut */ }
    }
  }
  return 'https://cdn.nuranantoscans.my.id';
}

// num halaman → "Image01.webp" (2 digit, samakan dengan ReaderModal.makeUrl)
const pageFile = (n) => `Image${String(n).padStart(2, '0')}.webp`;

async function head(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    return res.status;
  } catch (e) {
    return `ERR:${e.message}`;
  }
}

async function main() {
  const files = fs.readdirSync(MANGA_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
  const catalog = files.map(f => JSON.parse(fs.readFileSync(path.join(MANGA_DIR, f), 'utf-8')));
  const cdn = resolveCdnBase(catalog);

  const now = Date.now();
  const locked = [];
  for (const m of catalog) {
    for (const ch of (m.chapters || [])) {
      const protectedUntil = ch.memberAccess && ch.publicDate ? ch.publicDate : ch.unlockDate;
      const isProtected = protectedUntil && new Date(protectedUntil).getTime() > now;
      if (isProtected) locked.push({ mangaId: m.id, ch });
    }
  }

  console.log(`🔎 CDN publik: ${cdn}`);
  console.log(`🔒 Chapter terkunci ditemukan: ${locked.length}\n`);

  if (locked.length === 0) {
    console.log('✅ Tidak ada chapter terkunci saat ini — tidak ada yang bisa bocor.');
    return;
  }

  let leaks = 0;
  for (const { mangaId, ch } of locked) {
    const pages = ALL_PAGES ? Array.from({ length: ch.pages || 1 }, (_, i) => i + 1) : [1];
    let chapterLeak = false;
    for (const p of pages) {
      const chapterFolder = ch.r2_folder ?? ch.chapter_number;
      const url = `${cdn}/manga/${mangaId}/${chapterFolder}/${pageFile(p)}`;
      const status = await head(url);
      if (status === 200) {
        chapterLeak = true; leaks++;
        console.log(`❌ BOCOR  ${mangaId} ${ch.title} (hal ${p}) → 200  ${url}`);
      } else if (status !== 404) {
        console.log(`⚠️  ?     ${mangaId} ${ch.title} (hal ${p}) → ${status}  ${url}`);
      }
    }
    if (!chapterLeak && !ALL_PAGES) {
      console.log(`✅ aman   ${mangaId} ${ch.title} (unlock ${ch.unlockDate})`);
    }
  }

  console.log('');
  if (leaks > 0) {
    console.error(`❌ ${leaks} kebocoran terdeteksi! Gambar locked ada di bucket PUBLIK.`);
    console.error('   Hapus dari manga-media (CDN) — chapter terkunci hanya boleh di manga-locked.');
    process.exit(1);
  }
  console.log('✅ Semua chapter terkunci AMAN (tidak ada di bucket publik).');
}

main().catch(err => { console.error('Gagal:', err); process.exit(1); });
