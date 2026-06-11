import fs from 'fs';
import path from 'path';

const chaptersDir = './manga';
const outDir = './public/manga';

// Fix multi-level UTF-8 mojibake (bisa double atau triple encoded)
// Loop sampai stabil: stop saat ada char > U+00FF, atau decode tidak berubah, atau error
function fixMojibake(str) {
  if (typeof str !== 'string') return str;
  let current = str;
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < current.length; i++) {
      if (current.charCodeAt(i) > 255) return current;
    }
    try {
      const bytes = new Uint8Array(current.length);
      for (let i = 0; i < current.length; i++) bytes[i] = current.charCodeAt(i);
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (decoded === current) return current;
      current = decoded;
    } catch {
      return current;
    }
  }
  return current;
}

function fixEncoding(val) {
  if (typeof val === 'string') return fixMojibake(val);
  if (Array.isArray(val))      return val.map(fixEncoding);
  if (val && typeof val === 'object')
    return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, fixEncoding(v)]));
  return val;
}

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
    const dist = data.statistics?.[mangadexId]?.rating?.distribution;
    if (!dist) return null;

    // Hitung weighted average dari distribusi
    let totalVotes = 0;
    let weightedSum = 0;
    for (let score = 1; score <= 10; score++) {
      const votes = dist[String(score)] || 0;
      totalVotes += votes;
      weightedSum += score * votes;
    }
    if (totalVotes === 0) return null;
    return weightedSum / totalVotes;
  } catch {
    return null;
  }
}

async function buildCatalog() {
  const catalog = [];

  // views dibaca langsung dari manga meta.json (field chapter_views)

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

    const manga = fixEncoding(JSON.parse(fs.readFileSync(metaPath, 'utf-8')));

    // Extract mangadex_id dari mangadex_url kalau ada
    if (manga.mangadex_url && !manga.mangadex_id) {
      const match = manga.mangadex_url.match(/\/title\/([a-f0-9-]{36})/);
      if (match) manga.mangadex_id = match[1];
    }

    // Fetch rating dari MangaDex
    if (manga.mangadex_id) {
      console.log(`📡 Fetching rating for ${manga.title}...`);
      manga.rating = await fetchMangaDexRating(manga.mangadex_id);
      if (manga.rating) {
        manga.rating = Math.round(manga.rating * 100) / 100; // 2 desimal (x.xx)
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
      const ch = fixEncoding(JSON.parse(fs.readFileSync(chMetaPath, 'utf-8')));

      // pages wajib diisi
      if (!ch.pages || ch.pages < 1) {
        console.warn(`⚠️  SKIP ${slug} Ch.${ch.chapter_number}: field "pages" wajib diisi!`);
        continue;
      }

      // Auto-generate id, title, dan r2_prefix
      ch.id = `${slug}-ch-${ch.chapter_number}`;
      ch.r2_prefix = `manga/${slug}/${ch.chapter_number}/`;
      if (!ch.title) {
        ch.title = manga.status === 'ONESHOT' ? 'Oneshot' : `Ch. ${ch.chapter_number}`;
      }

      // release_date wajib diisi via generate_meta.py, tidak di-generate otomatis

      // Hitung unlockDate (camelCase agar sesuai frontend)
      if (ch.lock_hours > 0) {
        const unlockDate = new Date(ch.release_date);
        unlockDate.setHours(unlockDate.getHours() + ch.lock_hours);
        ch.unlockDate = unlockDate.toISOString();
      } else {
        ch.unlockDate = null;
      }

      // isLocked: terkunci kalau unlockDate masih di masa depan
      ch.isLocked = ch.unlockDate ? new Date(ch.unlockDate) > new Date() : false;

      // isNew dihitung di frontend dari release_date (bukan disimpan di catalog)

      // Views per chapter dari manga meta.json (field chapter_views)
      ch.views = (manga.chapter_views ?? {})[String(ch.chapter_number)] ?? 0;

      chapters.push(ch);
    }

    // Urutkan chapter: terbaru di atas (descending)
    chapters.sort((a, b) => b.chapter_number - a.chapter_number);

    // Total views manga = jumlah semua chapter views
    manga.total_views = chapters.reduce((sum, ch) => sum + ch.views, 0);
    if (manga.total_views > 0) {
      console.log(`   👁  ${manga.title} — total ${manga.total_views} views`);
      for (const [ch, v] of Object.entries(manga.chapter_views ?? {})) {
        console.log(`        Chapter ${ch.padEnd(5)} ${v} view${v > 1 ? 's' : ''}`);
      }
    }

    // next_update diambil dari chapter terbaru (chapters sudah diurutkan desc)
    manga.next_update = chapters[0]?.next_update ?? null;

    // Urutkan genre abjad
    if (Array.isArray(manga.genres)) manga.genres.sort();

    // Normalisasi status & type — case insensitive
    const statusMap = { 'ongoing':'Ongoing', 'hiatus':'Hiatus', 'tamat':'Tamat', 'oneshot':'Oneshot', 'oneshoot':'Oneshot' };
    const typeMap   = { 'manga':'MANGA', 'manhwa':'MANHWA', 'manhua':'MANHUA', 'novel':'NOVEL' };
    manga.status = statusMap[manga.status?.toLowerCase()] ?? manga.status;
    manga.type   = typeMap[manga.type?.toLowerCase()] ?? manga.type;

    // coverUrl dari covers[0]
    manga.coverUrl = manga.cover_dev ?? manga.covers?.[0] ?? null;
    delete manga.cover_dev;

    // Simpan full detail per manga → public/manga/{id}.json
    // Frontend fetch ini saat user buka halaman detail manga
    const mangaPublicDir = './public/manga';
    fs.mkdirSync(mangaPublicDir, { recursive: true });
    fs.writeFileSync(
      path.join(mangaPublicDir, `${slug}.json`),
      JSON.stringify({ ...manga, chapters }, null, 2),
      'utf-8'
    );

    // index.json hanya simpan info dasar + 3 chapter terbaru (untuk kartu)
    catalog.push({
      id:           manga.id,
      title:        manga.title,
      alt_title:    manga.alt_title,
      description:  manga.description,
      status:       manga.status,
      type:         manga.type,
      author:       manga.author,
      coverUrl:     manga.coverUrl,
      covers:       manga.covers,
      genres:       manga.genres,
      rating:       manga.rating,
      total_views:  manga.total_views,
      isTrending:   manga.isTrending,
      next_update:  manga.next_update,
      chapters:     chapters.slice(0, 3),
    });

    console.log(`✅ ${manga.title} — ${chapters.length} chapters`);
  }

  // Trending: top 5 manga by total_views (otomatis)
  const byViews = [...catalog].sort((a, b) => (b.total_views ?? 0) - (a.total_views ?? 0));
  const trendingIds = new Set(byViews.slice(0, 5).map(m => m.id));
  catalog.forEach(m => { m.isTrending = trendingIds.has(m.id); });

  // Urutkan homepage: manga yang paling baru diupdate tampil paling atas
  catalog.sort((a, b) => {
    const dateA = a.chapters[0]?.release_date ?? '0';
    const dateB = b.chapters[0]?.release_date ?? '0';
    return dateB.localeCompare(dateA);
  });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'index.json'),
    JSON.stringify(catalog, null, 2),
    'utf-8'
  );

  console.log(`\n📦 index.json: ${catalog.length} manga`);
  console.log(`🔥 Trending: ${[...trendingIds].join(', ')}`);

  // Sync chapter locks ke Worker (jika env var tersedia)
  const workerUrl   = process.env.WORKER_URL;
  const adminSecret = process.env.WORKER_ADMIN_SECRET;
  if (workerUrl && adminSecret) {
    const locks = [];
    for (const manga of catalog) {
      for (const ch of manga.chapters) {
        if (ch.isLocked && ch.unlockDate) {
          locks.push({ chapter_id: ch.id, unlock_at: ch.unlockDate });
        }
      }
    }
    if (locks.length) {
      // Retry 3x — pastikan lock tersinkron SEBELUM catalog di-deploy ke Pages
      let synced = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(`${workerUrl}/api/admin/sync-locks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
            body: JSON.stringify({ locks }),
          });
          if (res.ok) {
            console.log(`🔒 Synced ${locks.length} locks → Worker OK (attempt ${attempt})`);
            synced = true;
            break;
          }
          console.warn(`⚠️  Attempt ${attempt}: ${await res.text()}`);
        } catch (e) {
          console.warn(`⚠️  Attempt ${attempt}: ${e.message}`);
        }
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
      }
      if (!synced) {
        console.error('❌ Lock sync gagal 3x — batalkan deploy agar chapter tidak bocor!');
        process.exit(1);
      }
    }
  }
}

buildCatalog().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
