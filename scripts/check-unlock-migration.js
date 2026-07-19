#!/usr/bin/env node
/**
 * check-unlock-migration.js — verifikasi transisi locked → free.
 *
 * Untuk tiap chapter yang punya `unlockDate`:
 *   - MASIH terkunci (unlock di masa depan) → pastikan TIDAK bocor di cdn publik (harus 404).
 *   - SUDAH lewat unlock           → pastikan terbaca: cdn (sudah dimigrasi) ATAU
 *                                     images. (migrasi on-access via image-worker).
 *
 * Jalankan:
 *   node scripts/check-unlock-migration.js              # semua chapter ber-unlockDate
 *   node scripts/check-unlock-migration.js Yuumei 20    # chapter spesifik
 *
 * Exit code 1 kalau ada kebocoran (locked 200 di cdn) atau chapter unlocked tak terbaca.
 * Catatan: pakai header Referer agar lolos anti-hotlink image-worker (GET, bukan HEAD —
 * HEAD di image-worker selalu 200, jadi tak bisa dipakai untuk cek keberadaan nyata).
 */

import fs from 'fs';
import path from 'path';

const MANGA_DIR = './public/manga';
const SITE = 'https://nuranantoscans.my.id';
const [argManga, argCh] = process.argv.slice(2);
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
  'Referer': `${SITE}/`,
  'Sec-Fetch-Dest': 'image',
  'Sec-Fetch-Mode': 'no-cors',
  'Sec-Fetch-Site': 'same-site',
};

// cdn (R2 publik langsung) dari host coverUrl; images. = ganti subdomain cdn → images
function resolveBases(catalog) {
  for (const m of catalog) {
    const url = m.coverUrls?.desktop || m.coverUrl;
    if (typeof url === 'string' && url.startsWith('http')) {
      try {
        const origin = new URL(url).origin;              // https://cdn.nuranantoscans.my.id
        return { cdn: origin, images: origin.replace('cdn.', 'images.') };
      } catch { /* lanjut */ }
    }
  }
  return { cdn: 'https://cdn.nuranantoscans.my.id', images: 'https://images.nuranantoscans.my.id' };
}

const pageFile = (n) => `Image${String(n).padStart(2, '0')}.webp`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;

async function status(url, opts) {
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const wait = Math.max(0, 500 - (Date.now() - lastRequestAt));
      if (wait) await sleep(wait);
      lastRequestAt = Date.now();
      const res = await fetch(url, {
        ...opts,
        headers: { ...BROWSER_HEADERS, ...(opts?.headers || {}) },
      });
      if (res.status !== 429 || attempt === 1) return res.status;
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 10_500);
    }
  } catch (e) {
    return `ERR:${e.message}`;
  }
  return 'ERR:unknown';
}

function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} mnt`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} jam`;
  return `${Math.round(h / 24)} hari`;
}

async function main() {
  const files = fs.readdirSync(MANGA_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
  const catalog = files.map(f => JSON.parse(fs.readFileSync(path.join(MANGA_DIR, f), 'utf-8')));
  const { cdn, images } = resolveBases(catalog);
  const now = Date.now();

  const targets = [];
  for (const m of catalog) {
    for (const ch of (m.chapters || [])) {
      if (!ch.unlockDate) continue;
      if (argManga && m.id !== argManga) continue;
      if (argCh && String(ch.chapter_number) !== String(argCh)) continue;
      targets.push({ mangaId: m.id, ch });
    }
  }

  if (!targets.length) {
    console.log(`Tidak ada chapter ber-unlockDate${argManga ? ` untuk ${argManga} ${argCh || ''}` : ''}.`);
    return;
  }

  console.log(`🔎 cdn: ${cdn}\n🔎 images: ${images}\n`);
  let issues = 0;

  for (const { mangaId, ch } of targets) {
    const chapterFolder = ch.r2_folder ?? ch.chapter_number;
    const rel = `/manga/${mangaId}/${chapterFolder}/${pageFile(1)}`;
    const unlockMs = new Date(ch.unlockDate).getTime();

    if (unlockMs > now) {
      // Masih terkunci → cdn publik HARUS 404 (tidak bocor)
      const c = await status(`${cdn}${rel}`, { method: 'HEAD', redirect: 'manual' });
      if (c === 200) {
        issues++;
        console.log(`❌ BOCOR  ${mangaId} Ch.${ch.chapter_number} — fase privat tetapi 200 di cdn!`);
      } else {
        console.log(`🔒 aman   ${mangaId} Ch.${ch.chapter_number} — Early Access (${fmtDuration(unlockMs - now)} lagi), cdn=${c}`);
      }
    } else {
      // Sudah lewat unlock → harus terbaca (cdn migrasi, atau images on-access)
      const c = await status(`${cdn}${rel}`, { method: 'HEAD' });
      const i = await status(`${images}${rel}`, { method: 'GET' });
      if (c === 200 || i === 200) {
        const via = c === 200 ? 'cdn (sudah dimigrasi)' : `images (migrasi on-access), cdn=${c}`;
        console.log(`✅ free   ${mangaId} Ch.${ch.chapter_number} — public ${fmtDuration(now - unlockMs)} lalu; terbaca via ${via}`);
      } else {
        issues++;
        console.log(`❌ GAGAL  ${mangaId} Ch.${ch.chapter_number} — sudah unlock tapi cdn=${c} & images=${i} (TAK TERBACA)`);
      }
    }
  }

  console.log('');
  if (issues > 0) {
    console.error(`❌ ${issues} masalah ditemukan.`);
    process.exit(1);
  }
  console.log('✅ Semua transisi locked→free sehat (terkunci aman, unlocked terbaca).');
}

main().catch(err => { console.error('Gagal:', err); process.exit(1); });
