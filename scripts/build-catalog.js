import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Ambil tanggal commit terakhir dalam WIB (UTC+7)
function getFileCommitDate(filePath) {
  try {
    // %cI = ISO 8601 dengan timezone info dari git config
    // Kita override TZ ke WIB agar konsisten
    const raw = execSync(
      `git log -1 --format="%cI" -- "${filePath}"`,
      { encoding: 'utf-8', env: { ...process.env, TZ: 'Asia/Jakarta' } }
    ).trim();

    if (!raw) return nowWIB();

    // Konversi ke WIB (UTC+7)
    const d = new Date(raw);
    return toWIB(d);
  } catch {
    return nowWIB();
  }
}

// Ubah Date ke string ISO dengan offset +07:00
function toWIB(date) {
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().replace('Z', '+07:00');
}

function nowWIB() {
  return toWIB(new Date());
}

const chaptersDir = './chapters';
const outDir = './src/data';

// Fetch rating dari MangaDex API
// mangadex_id: null → rating null (manga original / tidak ada di MangaDex)
async function fetchMangaDexRating(mangadexId) {
  if (!mangadexId) return null;
  try {
    const res = await fetch(
      `https://api.mangadex.org/statistics/manga/${mangadexId}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const stats = data.statistics?.[mangadexId];
    // Pakai bayesian (lebih stabil) dengan fallback ke average
    return stats?.rating?.bayesian ?? stats?.rating?.average ?? null;
  } catch {
    return null;
  }
}

async function buildCatalog() {
  const catalog = [];
  const mangaSlugs = fs.readdirSync(chaptersDir).filter(f =>
    fs.statSync(path.join(chaptersDir, f)).isDirectory()
  );

  for (const slug of mangaSlugs) {
    const mangaPath = path.join(chaptersDir, slug);
    const metaPath = path.join(mangaPath, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      console.warn(`⚠️  Skipping ${slug}: no meta.json`);
      continue;
    }

    const manga = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    // Fetch rating dari MangaDex
    if (manga.mangadex_id) {
      console.log(`📡 Fetching rating for ${manga.title}...`);
      manga.rating = await fetchMangaDexRating(manga.mangadex_id);
      if (manga.rating) {
        manga.rating = Math.round(manga.rating * 10) / 10; // 1 desimal
        console.log(`   ⭐ ${manga.rating}`);
      }
    } else {
      manga.rating = null;
    }

    // Kumpulkan semua chapter
    const chapters = [];
    for (const entry of fs.readdirSync(mangaPath)) {
      const chapterPath = path.join(mangaPath, entry);
      if (!fs.statSync(chapterPath).isDirectory()) continue;
      const chMetaPath = path.join(chapterPath, 'meta.json');
      if (!fs.existsSync(chMetaPath)) continue;
      const ch = JSON.parse(fs.readFileSync(chMetaPath, 'utf-8'));

      // Auto-generate id dan title kalau tidak diisi
      ch.id = `${slug}-ch-${ch.chapter_number}`;
      if (!ch.title) {
        ch.title = `Ch. ${ch.chapter_number}`;
      }

      // Auto-fill release_date dari git commit time kalau tidak diisi manual
      if (!ch.release_date) {
        ch.release_date = getFileCommitDate(chMetaPath);
      }

      // Hitung unlock_date
      if (ch.lock_hours > 0) {
        const unlockDate = new Date(ch.release_date);
        unlockDate.setHours(unlockDate.getHours() + ch.lock_hours);
        ch.unlock_date = unlockDate.toISOString();
      } else {
        ch.unlock_date = null; // gratis
      }

      chapters.push(ch);
    }

    // Urutkan chapter: terbaru di atas (descending)
    chapters.sort((a, b) => b.chapter_number - a.chapter_number);

    // coverUrl: pakai cover_dev saat development (jika ada), fallback ke covers[0]
    manga.coverUrl = manga.cover_dev ?? manga.covers?.[0] ?? null;
    delete manga.cover_dev; // jangan masuk catalog production

    catalog.push({ ...manga, chapters });
    console.log(`✅ ${manga.title} — ${chapters.length} chapters`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'catalog.json'),
    JSON.stringify(catalog, null, 2),
    'utf-8'
  );

  console.log(`\n📦 catalog.json: ${catalog.length} manga`);
}

buildCatalog().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
