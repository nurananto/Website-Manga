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
// Webhook channel #manga-list — intro 1× saat manga BARU ditambah (opsional)
const DISCORD_MANGALIST_WEBHOOK_URL = process.env.DISCORD_MANGALIST_WEBHOOK_URL || '';
// Backfill: kirim intro SEMUA manga ke #manga-list (sekali, untuk isi channel kosong)
const MANGALIST_BACKFILL = process.env.MANGALIST_BACKFILL === '1';
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

// SAFETY-NET MOJIBAKE — JANGAN HAPUS.
// Memperbaiki mojibake UTF-8 bertingkat (double/triple encoded) HANYA untuk output
// publik (index.json + per-manga JSON); TIDAK menulis balik ke source meta.json.
// Aman & idempotent: kalau sudah ada karakter CJK asli (>U+00FF) langsung berhenti,
// jadi tak pernah merusak judul yang sudah benar. Ini yang bikin situs tetap tampil
// benar walau source sempat rusak. Akar korupsi ada di cron api-worker (decode UTF-8),
// bukan di sini. Semua read/write meta di file ini WAJIB pakai 'utf-8' — jangan dilepas.
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

// fetch dengan timeout (AbortController) — cegah Action menggantung kalau server
// eksternal (MangaDex/Discord/FB/Worker) lambat atau tidak merespons.
async function fetchT(url, options = {}, ms = 15000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Fetch rating dari MangaDex API
// mangadex_id: null → rating null (manga original / tidak ada di MangaDex)
async function fetchMangaDexRating(mangadexId) {
  if (!mangadexId) return null;
  try {
    const res = await fetchT(
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

// Hitung karakter embed yang dihitung Discord ke limit 6000/pesan
// (title + description + footer.text + author.name + fields). URL gambar & timestamp tak dihitung.
function embedChars(e) {
  return (e.title?.length || 0) + (e.description?.length || 0) +
         (e.footer?.text?.length || 0) + (e.author?.name?.length || 0) +
         (e.fields || []).reduce((s, f) => s + (f.name?.length || 0) + (f.value?.length || 0), 0);
}
// Pecah embed jadi beberapa pesan: maks 10 embed DAN maks ~5500 char per pesan.
function chunkEmbeds(embeds, maxCount = 10, maxChars = 5500) {
  const chunks = [];
  let cur = [], curChars = 0;
  for (const e of embeds) {
    const c = embedChars(e);
    if (cur.length && (cur.length >= maxCount || curChars + c > maxChars)) {
      chunks.push(cur); cur = []; curChars = 0;
    }
    cur.push(e); curChars += c;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

// ── Kirim notifikasi Discord untuk chapter-chapter baru ─────────────────
// Satu embed per chapter, dikirim setelah catalog selesai dibangun.
// Hanya berjalan kalau DISCORD_WEBHOOK_URL diset & ada chapter baru.
async function sendDiscordNotifications(newChapters, webhookUrl, siteUrl) {
  if (!webhookUrl || newChapters.length === 0) return;
  const base  = siteUrl.replace(/\/$/, '');
  const GUILD = '1517520079108182036'; // server Discord (untuk link diskusi per judul)

  const logoIcon = `${base}/logo-header.webp`;
  const footer   = { text: 'Nurananto Scanlation • Update Terbaru', icon_url: logoIcon };
  // "Tombol" link teks (webhook tidak bisa button asli)
  const linksOf = (ch) => {
    const links = [`🌐 [Baca](${base}/${ch.mangaId})`];
    if (ch.discordChannelId)             links.push(`💬 [Diskusi](https://discord.com/channels/${GUILD}/${ch.discordChannelId})`);
    return links.join('  •  ');
  };
  const mkEmbed = (ch, descTop) => ({
    title:     ch.mangaTitle,
    url:       `${base}/${ch.mangaId}`,
    description: [descTop, linksOf(ch)].join('\n'),
    color:     0x5865F2,
    image:     ch.coverUrl ? { url: ch.coverUrl } : undefined, // cover besar
    footer,
    timestamp: ch.releaseDate || new Date().toISOString(),
  });

  // >3 chapter dari judul SAMA → 1 embed gabungan. Selain itu per-chapter (kaya).
  const byManga = new Map();
  for (const ch of newChapters) {
    if (!byManga.has(ch.mangaId)) byManga.set(ch.mangaId, []);
    byManga.get(ch.mangaId).push(ch);
  }
  const embeds = [];
  for (const list of byManga.values()) {
    if (list.length > 3) {
      const nums = list.map(c => c.chapterNumber);
      embeds.push(mkEmbed(list[0], `📖 **${list.length} chapter baru** (Ch ${nums[nums.length - 1]}–${nums[0]})`));
    } else {
      for (const ch of list) embeds.push(mkEmbed(ch, `📖 **${ch.chapterTitle}**`));
    }
  }

  // Pecah pesan: maks 10 embed DAN ≤5500 char/pesan (limit Discord 6000)
  const chunks = chunkEmbeds(embeds);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const res = await fetchT(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Nurananto Scanlation',
          content:  i === 0 ? '## 📢 Baru Saja Dirilis!' : undefined,
          embeds:   chunk,
        }),
      });
      if (!res.ok) console.warn(`⚠️  Discord notif gagal: ${res.status} ${await res.text()}`);
      else console.log(`🔔 Discord notifikasi terkirim: ${chunk.length} chapter baru`);
    } catch (e) {
      console.warn(`⚠️  Discord webhook error: ${e.message}`);
    }
    // Hindari rate limit Discord (max 5 req/2 detik per webhook)
    if (i + 1 < chunks.length) await new Promise(r => setTimeout(r, 1000));
  }
}

// ── Intro 1× per manga BARU ke channel #manga-list (sinopsis lengkap + cover) ──
async function sendMangaIntros(newManga, webhookUrl, siteUrl) {
  if (!webhookUrl || newManga.length === 0) return;
  const base  = siteUrl.replace(/\/$/, '');
  const GUILD = '1517520079108182036';

  const embeds = newManga.map(m => {
    const links = [`🌐 [Website](${base}/${m.id})`];
    if (m.discordChannelId) links.push(`💬 [Diskusi](https://discord.com/channels/${GUILD}/${m.discordChannelId})`);
    const desc = [];
    if (m.genres?.length) desc.push(`🏷️ ${m.genres.join(' · ')}`);
    if (m.synopsis)       desc.push('', (m.synopsis || '').trim());
    desc.push('', links.join('  •  '));
    return {
      author:    { name: '📚 Judul Baru di Nurananto Scanlation', url: base },
      title:     m.title,
      url:       `${base}/${m.id}`,
      description: desc.join('\n').slice(0, 4000),
      color:     0x5865F2,
      image:     m.coverUrl ? { url: m.coverUrl } : undefined,
      footer:    { text: m.rating ? `Nurananto Scanlation • ⭐ ${m.rating}` : 'Nurananto Scanlation', icon_url: `${base}/logo-header.webp` },
    };
  });

  // Sinopsis panjang → kirim 1 embed per pesan (limit Discord ~6000 char/pesan
  // bila digabung; 10 sekaligus pasti ditolak). Jeda + retry 429.
  const post = (embed) => fetchT(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Nurananto Scanlation', embeds: [embed] }),
  });
  let sent = 0;
  for (const embed of embeds) {
    try {
      let res = await post(embed);
      if (res.status === 429) {
        const wait = ((await res.json().catch(() => ({}))).retry_after || 2);
        await new Promise(r => setTimeout(r, (wait + 0.5) * 1000));
        res = await post(embed); // retry sekali
      }
      if (res.ok) sent++;
      else console.warn(`⚠️  Manga-list notif gagal (${embed.title}): ${res.status} ${await res.text()}`);
    } catch (e) { console.warn(`⚠️  Manga-list webhook error (${embed.title}): ${e.message}`); }
    await new Promise(r => setTimeout(r, 1200)); // anti rate-limit (5 req / 2 dtk)
  }
  console.log(`📚 Intro manga-list terkirim: ${sent}/${embeds.length} judul`);
}

async function buildCatalog() {
  const catalog = [];
  const newChaptersList = []; // dikumpulkan untuk notifikasi Discord
  const newMangaList    = []; // manga BARU (intro 1× ke #manga-list)

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

    // Tangkap chapter LAMA SEKARANG, sebelum per-manga JSON ditimpa di bawah —
    // kalau dibaca setelah ditimpa, semua chapter dianggap "lama" (notif tak pernah jalan).
    const isNewManga = !fs.existsSync(prevJsonPath); // manga belum pernah ada → intro 1×
    let prevChapterNums = new Set();
    if (fs.existsSync(prevJsonPath)) {
      try {
        prevChapterNums = new Set((JSON.parse(fs.readFileSync(prevJsonPath, 'utf-8')).chapters || []).map(c => c.chapter_number));
      } catch {}
    }
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

    // Total views manga = jumlah semua chapter views (tidak di-log; views disync harian oleh cron)
    manga.total_views = chapters.reduce((sum, ch) => sum + ch.views, 0);

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

    // Manga BARU (belum pernah ada JSON-nya) → intro 1× ke #manga-list.
    // MANGALIST_BACKFILL=1 → kirim SEMUA manga (sekali, untuk isi channel kosong).
    if (isNewManga || MANGALIST_BACKFILL) {
      newMangaList.push({
        id:               manga.id,
        title:            manga.title,
        coverUrl:         manga.coverUrl,
        genres:           manga.genres,
        rating:           manga.rating,
        synopsis:         manga.description,
        discordChannelId: manga.discord_channel_id,
        mangadexUrl:      manga.mangadex_url || manga.mangadex_id || '',
      });
    }

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

    // Deteksi chapter baru (hanya saat push spesifik, bukan full cron build).
    // prevChapterNums sudah ditangkap di atas SEBELUM file ditimpa.
    if (CHANGED_SLUGS.length > 0 && CHANGED_SLUGS.includes(slug)) {
      for (const ch of chapters) {
        if (!prevChapterNums.has(ch.chapter_number)) {
          newChaptersList.push({
            mangaId:          manga.id,
            mangaTitle:       manga.title,
            coverUrl:         manga.coverUrl,
            chapterNumber:    ch.chapter_number,
            chapterTitle:     ch.title,
            isLocked:         ch.isLocked,
            releaseDate:      ch.release_date,
            discordChannelId: manga.discord_channel_id,
            mangadexUrl:      manga.mangadex_url || manga.mangadex_id || '',
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
          const res = await fetchT(`${workerUrl}/api/admin/sync-locks`, {
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
  await sendMangaIntros(newMangaList, DISCORD_MANGALIST_WEBHOOK_URL, SITE_URL);
}

buildCatalog().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
