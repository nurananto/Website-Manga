#!/usr/bin/env node
/**
 * Audit keamanan dan transisi chapter Early Access dalam satu perintah.
 *
 * - Belum unlock: gambar tidak boleh ada di CDN publik (harus 404).
 * - Sudah unlock: gambar harus tersedia melalui CDN atau fallback Image Worker.
 *
 * Pemakaian:
 *   npm run check:chapters
 *   npm run check:chapters -- --all-pages
 *   npm run check:chapters -- Yuumei 20
 *
 * --all-pages memeriksa seluruh halaman, baik yang masih terkunci maupun yang
 * sudah publik. Tanpa opsi ini, pemeriksaan cukup memakai halaman pertama.
 */

import fs from 'fs';
import path from 'path';

const MANGA_DIR = './public/manga';
const SITE = process.env.SITE_URL || 'https://nuranantoscans.pages.dev';
const rawArgs = process.argv.slice(2);
const ALL_PAGES = rawArgs.includes('--all-pages');
const [argManga, argChapter] = rawArgs.filter((arg) => !arg.startsWith('--'));
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
  'Referer': `${SITE}/`,
  'Sec-Fetch-Dest': 'image',
  'Sec-Fetch-Mode': 'no-cors',
  'Sec-Fetch-Site': 'same-site',
};

function loadCatalog() {
  return fs.readdirSync(MANGA_DIR)
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .map((file) => JSON.parse(fs.readFileSync(path.join(MANGA_DIR, file), 'utf-8')));
}

function resolveBases(catalog) {
  let cdn = (process.env.CDN_BASE || '').replace(/\/$/, '');
  if (!cdn) {
    for (const manga of catalog) {
      const value = manga.coverUrls?.desktop || manga.coverUrl;
      if (typeof value !== 'string' || !value.startsWith('http')) continue;
      try {
        cdn = new URL(value).origin;
        break;
      } catch { /* lanjut */ }
    }
  }
  cdn ||= 'https://cdn.nuranantoscans.my.id';
  const images = (process.env.IMAGE_BASE || cdn.replace('cdn.', 'images.')).replace(/\/$/, '');
  return { cdn, images };
}

const pageFile = (number) => `Image${String(number).padStart(2, '0')}.webp`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;

async function requestStatus(url, method) {
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const wait = Math.max(0, 500 - (Date.now() - lastRequestAt));
      if (wait) await sleep(wait);
      lastRequestAt = Date.now();
      const response = await fetch(url, {
        method,
        redirect: 'manual',
        headers: BROWSER_HEADERS,
      });
      if (response.status !== 429 || attempt === 1) return response.status;
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 10_500);
    }
  } catch (error) {
    return `ERR:${error.message}`;
  }
  return 'ERR:unknown';
}

function formatDuration(ms) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} jam`;
  return `${Math.round(hours / 24)} hari`;
}

function selectTargets(catalog) {
  const targets = [];
  for (const manga of catalog) {
    for (const chapter of manga.chapters || []) {
      if (!chapter.unlockDate) continue;
      if (argManga && manga.id !== argManga) continue;
      if (argChapter && String(chapter.chapter_number) !== String(argChapter)) continue;
      targets.push({ mangaId: manga.id, chapter });
    }
  }
  return targets;
}

// Folder R2 + daftar halaman yang diperiksa untuk satu chapter.
// --all-pages memeriksa semuanya; default cukup halaman pertama.
function chapterPagePlan(chapter) {
  return {
    folder: chapter.r2_folder ?? chapter.chapter_number,
    pages: ALL_PAGES
      ? Array.from({ length: chapter.pages || 1 }, (_, index) => index + 1)
      : [1],
  };
}

async function auditLocked({ mangaId, chapter }, cdn, now) {
  const { folder, pages } = chapterPagePlan(chapter);
  let issues = 0;

  for (const page of pages) {
    const url = `${cdn}/manga/${mangaId}/${folder}/${pageFile(page)}`;
    const status = await requestStatus(url, 'HEAD');
    if (status === 200) {
      issues++;
      console.log(`❌ BOCOR  ${mangaId} Ch.${chapter.chapter_number} hal.${page} — ada di CDN publik`);
    } else if (status !== 404) {
      issues++;
      console.log(`⚠️  GAGAL  ${mangaId} Ch.${chapter.chapter_number} hal.${page} — status CDN ${status}`);
    }
  }

  if (!issues) {
    const unlockAt = new Date(chapter.unlockDate).getTime();
    console.log(`🔒 aman   ${mangaId} Ch.${chapter.chapter_number} — unlock ${formatDuration(unlockAt - now)} lagi`);
  }
  return issues;
}

async function auditPublic({ mangaId, chapter }, cdn, images, now) {
  const { folder, pages } = chapterPagePlan(chapter);
  let issues = 0;
  let viaCdn = 0;
  let viaWorker = 0;

  for (const page of pages) {
    const relative = `/manga/${mangaId}/${folder}/${pageFile(page)}`;
    const cdnStatus = await requestStatus(`${cdn}${relative}`, 'HEAD');
    if (cdnStatus === 200) {
      viaCdn++;
      continue;
    }

    const imageStatus = await requestStatus(`${images}${relative}`, 'GET');
    if (imageStatus === 200) {
      viaWorker++;
      continue;
    }

    issues++;
    console.log(`❌ GAGAL  ${mangaId} Ch.${chapter.chapter_number} hal.${page} — CDN=${cdnStatus}, images=${imageStatus}`);
  }

  if (!issues) {
    const unlockAt = new Date(chapter.unlockDate).getTime();
    const sources = [
      viaCdn ? `${viaCdn} CDN` : '',
      viaWorker ? `${viaWorker} Image Worker` : '',
    ].filter(Boolean).join(', ');
    console.log(`✅ free   ${mangaId} Ch.${chapter.chapter_number} — ${formatDuration(now - unlockAt)} lalu (${sources})`);
  }
  return issues;
}

async function main() {
  const catalog = loadCatalog();
  const { cdn, images } = resolveBases(catalog);
  const targets = selectTargets(catalog);
  const now = Date.now();

  if (!targets.length) {
    console.log(`Tidak ada chapter terjadwal${argManga ? ` untuk ${argManga} ${argChapter || ''}` : ''}.`);
    return;
  }

  console.log(`🔎 CDN: ${cdn}`);
  console.log(`🔎 Images: ${images}`);
  console.log(`📚 Chapter diperiksa: ${targets.length}\n`);

  let issues = 0;
  for (const target of targets) {
    const unlockAt = new Date(target.chapter.unlockDate).getTime();
    if (!Number.isFinite(unlockAt)) {
      issues++;
      console.log(`❌ TANGGAL ${target.mangaId} Ch.${target.chapter.chapter_number} — unlockDate tidak valid`);
    } else if (unlockAt > now) {
      issues += await auditLocked(target, cdn, now);
    } else {
      issues += await auditPublic(target, cdn, images, now);
    }
  }

  console.log('');
  if (issues) {
    console.error(`❌ ${issues} masalah ditemukan.`);
    process.exit(1);
  }
  console.log('✅ Semua chapter aman dan transisi locked → free berfungsi.');
}

main().catch((error) => {
  console.error('Gagal:', error);
  process.exit(1);
});
