import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const chaptersDir = './manga';
const outDir = './public/manga';

// Manga yang berubah di push ini (dari workflow, koma-separated).
// Kosong = full build (cron mingguan / manual dispatch).
const CHANGED_SLUGS = (process.env.CHANGED_SLUGS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// Discord notifikasi chapter baru
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const SITE_URL = (process.env.SITE_URL || 'https://nuranantoscans.my.id').replace(/\/$/, '');

// Waktu commit PERTAMA yang menambahkan file — stabil, tidak berubah oleh commit berikutnya
function gitAddedDate(filePath) {
  try {
    const out = execSync(`git log --diff-filter=A --format=%aI -1 -- "${filePath}"`, { encoding: 'utf-8' }).trim();
    return out || null;
  } catch { return null; }
}

// Format ISO apapun → string WIB "YYYY-MM-DDTHH:MM:SS+07:00"
function toWibString(iso) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+07:00`;
}

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

// ── Kirim notifikasi Discord untuk chapter-chapter baru ─────────────────
// Satu embed per chapter, dikirim setelah catalog selesai dibangun.
// Hanya berjalan kalau DISCORD_WEBHOOK_URL diset & ada chapter baru.
async function sendDiscordNotifications(newChapters, webhookUrl, siteUrl) {
  if (!webhookUrl || newChapters.length === 0) return;
  const base = siteUrl.replace(/\/$/, '');
  const EMBED_COLOR = 0x5865F2; // Discord Blurple

  const embeds = newChapters.map(ch => ({
    title:       ch.mangaTitle,
    url:         `${base}/${ch.mangaId}`,
    color:       EMBED_COLOR,
    description: `**${ch.chapterTitle}** baru saja rilis!${ch.isLocked ? '\n🔒 *Chapter terkunci — buka dengan koin*' : ''}\n\n[📖 Baca Sekarang](${base}/${ch.mangaId})`,
    image:       ch.coverUrl ? { url: ch.coverUrl } : undefined,

    footer:      { text: 'MangaFlow • Update Terbaru' },
    timestamp:   ch.releaseDate || new Date().toISOString(),
  }));

  // Max 10 embed per pesan (limit Discord)
  for (let i = 0; i < embeds.length; i += 10) {
    const chunk = embeds.slice(i, i + 10);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Nurananto Scanslation', embeds: chunk }),
      });
      if (!res.ok) console.warn(`⚠️  Discord notif gagal: ${res.status} ${await res.text()}`);
      else console.log(`🔔 Discord notifikasi terkirim: ${chunk.length} chapter baru`);
    } catch (e) {
      console.warn(`⚠️  Discord webhook error: ${e.message}`);
    }
    // Hindari rate limit Discord (max 5 req/2 detik per webhook)
    if (i + 10 < embeds.length) await new Promise(r => setTimeout(r, 1000));
  }
}

async function buildCatalog() {
  const catalog = [];
  const newChaptersList = []; // dikumpulkan untuk notifikasi Discord

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

    // Fetch rating dari MangaDex — hanya untuk manga yang berubah di push ini.
    // Manga lain pakai rating dari hasil build sebelumnya (refresh penuh saat cron mingguan).
    const isChanged = CHANGED_SLUGS.length === 0 || CHANGED_SLUGS.includes(slug);
    const prevJsonPath = path.join(outDir, `${slug}.json`);
    if (manga.mangadex_id && isChanged) {
      console.log(`📡 Fetching rating for ${manga.title}...`);
      manga.rating = await fetchMangaDexRating(manga.mangadex_id);
      if (manga.rating) {
        manga.rating = Math.round(manga.rating * 100) / 100; // 2 desimal (x.xx)
        console.log(`   ⭐ ${manga.rating}`);
      }
    } else if (manga.mangadex_id && fs.existsSync(prevJsonPath)) {
      try {
        manga.rating = JSON.parse(fs.readFileSync(prevJsonPath, 'utf-8')).rating ?? null;
        console.log(`♻️  ${manga.title} — rating lama dipakai (${manga.rating ?? '—'})`);
      } catch { manga.rating = null; }
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
        ch.title = manga.status?.toLowerCase() === 'oneshot' ? 'Oneshot' : `Ch. ${ch.chapter_number}`;
      }

      // release_date: kalau belum ada di meta.json, ambil dari waktu commit PERTAMA
      // file meta.json chapter ini (WIB), lalu tulis balik agar permanen & stabil
      if (!ch.release_date) {
        const added = gitAddedDate(chMetaPath);
        ch.release_date = toWibString(added || Date.now());
        try {
          const raw = JSON.parse(fs.readFileSync(chMetaPath, 'utf-8'));
          raw.release_date = ch.release_date;
          fs.writeFileSync(chMetaPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
          console.log(`   🕐 ${slug} Ch.${ch.chapter_number} release_date ← waktu commit (${ch.release_date})`);
        } catch {}
      }

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

    // Normalisasi status & type — case insensitive.
    // Nilai resmi: Ongoing, Tamat, Hiatus, Oneshot. Sinonim umum dipetakan;
    // nilai tak dikenal default ke 'Ongoing' agar tampilan selalu konsisten.
    const statusMap = {
      'ongoing':'Ongoing', 'berlanjut':'Ongoing', 'berjalan':'Ongoing',
      'hiatus':'Hiatus',
      'tamat':'Tamat', 'end':'Tamat', 'ended':'Tamat', 'completed':'Tamat', 'finished':'Tamat', 'selesai':'Tamat',
      'oneshot':'Oneshot', 'oneshoot':'Oneshot',
    };
    const typeMap   = { 'manga':'MANGA', 'manhwa':'MANHWA', 'manhua':'MANHUA', 'novel':'NOVEL' };
    manga.status = statusMap[manga.status?.toLowerCase()] ?? 'Ongoing';
    manga.type   = typeMap[manga.type?.toLowerCase()] ?? manga.type;

    // coverUrl dari covers[0] (desktop), coverUrls untuk semua ukuran.
    // CDN_BASE (mis. https://cdn.nuranantoscans.my.id) → cover diserve langsung
    // dari R2 publik tanpa lewat image worker (0 invocation).
    const cdnBase = (process.env.CDN_BASE || '').replace(/\/$/, '');
    // cover_version (default 1) → cache-busting query. Naikkan di meta.json tiap
    // ganti cover supaya URL berubah → cover bisa di-cache lama (immutable) tanpa stale.
    const coverVer = Number.isFinite(manga.cover_version) ? manga.cover_version : 1;
    const vq = `?v=${coverVer}`;
    const coverFull = (key) => (key ? (cdnBase ? `${cdnBase}/${key}${vq}` : `${key}${vq}`) : null);
    manga.coverUrl = coverFull(manga.cover_dev ?? manga.covers?.[0]);
    manga.coverUrls = {
      desktop: coverFull(manga.covers?.[0]) ?? manga.coverUrl,
      tablet:  coverFull(manga.covers?.[1]) ?? manga.coverUrl,
      mobile:  coverFull(manga.covers?.[2]) ?? manga.coverUrl,
    };
    delete manga.cover_dev;

    // Galeri SEMUA cover (termasuk yang sedang dipakai) — terbaru duluan, URL via CDN
    if (Array.isArray(manga.cover_gallery)) {
      manga.cover_gallery = manga.cover_gallery
        .filter(g => g.keys?.length >= 3)
        .map(g => ({
          volume: g.volume ?? null,
          is_current: g.file === manga.mangadex_cover,
          urls: {
            desktop: coverFull(g.keys[0]),
            tablet:  coverFull(g.keys[1]),
            mobile:  coverFull(g.keys[2]),
          },
        }))
        .reverse();
    }

    // Simpan full detail per manga → public/manga/{id}.json
    // Frontend fetch ini saat user buka halaman detail manga
    const mangaPublicDir = './public/manga';
    fs.mkdirSync(mangaPublicDir, { recursive: true });
    fs.writeFileSync(
      path.join(mangaPublicDir, `${slug}.json`),
      JSON.stringify({ ...manga, chapters }, null, 2),
      'utf-8'
    );

    // index.json hanya simpan field yang DIPAKAI homepage (kartu, search, carousel)
    // + 3 chapter terbaru. Field detail-only (description, alt_title, covers, author,
    // type) sengaja TIDAK disertakan — sudah ada di per-manga JSON yang di-load
    // halaman detail. Tujuannya agar index.json tetap ramping saat judul bertambah.
    // description RINGKAS (~300 char) untuk FeaturedCarousel. Semua manga dapat
    // karena trending kini dinamis (lihat /api/trending). Versi penuh ada di
    // per-manga JSON (dipakai halaman detail). Potong di batas kata + elipsis.
    const rawDesc = manga.description || '';
    const shortDesc = rawDesc.length > 300
      ? rawDesc.slice(0, 300).replace(/\s+\S*$/, '') + '…'
      : rawDesc;
    catalog.push({
      id:           manga.id,
      title:        manga.title,
      description:  shortDesc,
      status:       manga.status,
      coverUrl:     manga.coverUrl,
      coverUrls:    manga.coverUrls,
      genres:       manga.genres,
      rating:       manga.rating,
      total_views:  manga.total_views,
      isTrending:   manga.isTrending,
      next_update:  manga.next_update,
      tamat_at_chapter:  manga.tamat_at_chapter ?? null,
      hiatus_at_chapter: manga.hiatus_at_chapter ?? null,
      // channel komentar Discord (untuk reader yang dibuka dari kartu homepage).
      // Hanya disertakan kalau diisi di meta.json, agar index tetap ramping.
      ...(manga.discord_channel_id ? { discord_channel_id: manga.discord_channel_id } : {}),
      chapters:     chapters.slice(0, 3),
    });

    // Deteksi chapter baru (hanya saat push spesifik, bukan full cron build)
    if (CHANGED_SLUGS.length > 0 && CHANGED_SLUGS.includes(slug)) {
      let prevChapterNums = new Set();
      if (fs.existsSync(prevJsonPath)) {
        try {
          const prevData = JSON.parse(fs.readFileSync(prevJsonPath, 'utf-8'));
          prevChapterNums = new Set((prevData.chapters || []).map(c => c.chapter_number));
        } catch {}
      }
      for (const ch of chapters) {
        if (!prevChapterNums.has(ch.chapter_number)) {
          newChaptersList.push({
            mangaId:       manga.id,
            mangaTitle:    manga.title,
            coverUrl:      manga.coverUrl,
            chapterNumber: ch.chapter_number,
            chapterTitle:  ch.title,
            isLocked:      ch.isLocked,
            releaseDate:   ch.release_date,
          });
          console.log(`   🔔 Chapter baru terdeteksi: ${manga.title} — ${ch.title}`);
        }
      }
    }

    console.log(`✅ ${manga.title} — ${chapters.length} chapters`);
  }

  // Trending: top 5 manga by total_views (otomatis)
  const byViews = [...catalog].sort((a, b) => (b.total_views ?? 0) - (a.total_views ?? 0));
  const trendingIds = new Set(byViews.slice(0, 5).map(m => m.id));
  // isTrending build-time = fallback (dipakai kalau /api/trending kosong/gagal).
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

  // Notifikasi Discord untuk chapter-chapter baru
  await sendDiscordNotifications(newChaptersList, DISCORD_WEBHOOK_URL, SITE_URL);
}

buildCatalog().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
