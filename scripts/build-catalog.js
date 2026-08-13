import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const chaptersDir = './manga';
const outDir = './public/manga';

// Sentinel unlockDate untuk lock permanen (lock_hours: -1) — chapter dibuka
// manual dengan mengubah lock_hours, bukan lewat timer.
const FOREVER_UNLOCK_DATE = '9999-12-31T00:00:00.000Z';

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
// Facebook Page — post chapter baru (opsional). Butuh Page ID + Page Access Token.
// .trim() — secret di GitHub sering kebawa spasi/newline saat paste; tanpa trim, ID jadi
// "1183...924 " → URL Graph rusak → error 100/33 "Object does not exist".
const FB_PAGE_ID    = (process.env.FB_PAGE_ID || '').trim();
const FB_PAGE_TOKEN = (process.env.FB_PAGE_TOKEN || '').trim();
const SITE_URL = (process.env.SITE_URL || 'https://nuranantoscans.my.id').replace(/\/$/, '');

// Waktu commit PERTAMA yang menambahkan file — stabil, tidak berubah oleh commit berikutnya.
// execFileSync (bukan execSync) — filePath jadi ELEMEN ARRAY argumen, bukan
// disisipkan ke teks command via template literal. execSync menjalankan lewat
// shell (git bash di Windows runner / sh di Linux), jadi kalau filePath (nama
// folder manga/chapter, ikut apa pun ada di repo) kebetulan mengandung
// karakter shell (`"`, `` ` ``, `$(...)`, `;`, dst), itu bisa DIINTERPRETASI
// ulang oleh shell alih-alih diperlakukan sebagai path biasa. execFileSync
// TIDAK pernah lewat shell — argumen selalu diteruskan apa adanya ke proses
// git, kebal dari karakter apa pun isinya.
function gitAddedDate(filePath) {
  try {
    const out = execFileSync(
      'git', ['log', '--diff-filter=A', '--format=%aI', '-1', '--', filePath],
      { encoding: 'utf-8' }
    ).trim();
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

// ── Halaman pertama chapter (Image01.webp) untuk notifikasi ───────────────
// Menggantikan cover di Discord & Facebook. Chapter GRATIS: URL publik via CDN
// (langsung embed). Chapter LOCKED: byte diambil dari bucket privat manga-locked
// (R2), karena halaman locked TIDAK boleh ada di bucket publik (lihat
// scripts/check-chapters.js). Butuh CF_ACCOUNT_ID + R2_ACCESS_KEY_ID +
// R2_SECRET_ACCESS_KEY + R2_LOCKED_BUCKET_NAME di env (lihat build-catalog.yml).
const CDN_BASE = (process.env.CDN_BASE || '').replace(/\/$/, '');
const pageFileName = (n) => `Image${String(n).padStart(2, '0')}.webp`; // samakan ReaderModal/check-chapters
const pageKey = (slug, chapterFolder, n) => `manga/${slug}/${chapterFolder}/${pageFileName(n)}`;

const STATUS_MAP = {
  'ongoing':'Ongoing', 'berlanjut':'Ongoing', 'berjalan':'Ongoing',
  'hiatus':'Hiatus',
  'tamat':'Tamat', 'end':'Tamat', 'ended':'Tamat', 'completed':'Tamat', 'finished':'Tamat', 'selesai':'Tamat',
  'oneshot':'Oneshot', 'oneshoot':'Oneshot', 'one shot':'Oneshot', 'one-shot':'Oneshot',
};
const TYPE_MAP = { 'manga':'MANGA', 'manhwa':'MANHWA', 'manhua':'MANHUA', 'novel':'NOVEL' };

function normalizeStatus(status) {
  return STATUS_MAP[String(status || '').trim().toLowerCase()] ?? 'Ongoing';
}

function normalizeType(type) {
  const raw = type == null ? '' : String(type);
  return TYPE_MAP[raw.trim().toLowerCase()] ?? type;
}

function chapterSortValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

function releaseSortValue(value) {
  const t = Date.parse(value || '');
  return Number.isFinite(t) ? t : 0;
}

// Kelompokkan daftar chapter baru per mangaId — dipakai notifikasi Discord & FB.
// Urutan asal dipertahankan (newChapters sudah desc terbaru→lama per judul).
function groupByManga(newChapters) {
  const byManga = new Map();
  for (const ch of newChapters) {
    if (!byManga.has(ch.mangaId)) byManga.set(ch.mangaId, []);
    byManga.get(ch.mangaId).push(ch);
  }
  return byManga;
}

function compareRecentChapters(a, b) {
  const byDate = releaseSortValue(b.release_date) - releaseSortValue(a.release_date);
  if (byDate !== 0) return byDate;
  return chapterSortValue(b.chapter_number) - chapterSortValue(a.chapter_number);
}

// Klien R2 dibuat lazy (sekali) — dipakai untuk bucket publik dan locked.
let _r2 = null;
async function getR2ObjectBytes(bucket, key, label) {
  const { CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!CF_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !bucket) {
    console.warn(`⚠️  R2 belum dikonfigurasi lengkap — lewati gambar ${label}`);
    return null;
  }
  try {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    if (!_r2) {
      _r2 = new S3Client({
        region: 'auto',
        endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      });
    }
    const res = await _r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const chunks = [];
    for await (const c of res.Body) chunks.push(c);
    return Buffer.concat(chunks);
  } catch (e) {
    console.warn(`⚠️  Gagal ambil gambar ${label}: ${e.message}`);
    return null;
  }
}

async function getPublicPageBytes(slug, chapterFolder, page) {
  const bucket = process.env.R2_PUBLIC_BUCKET_NAME || process.env.R2_BUCKET_NAME;
  return getR2ObjectBytes(bucket, pageKey(slug, chapterFolder, page), `public ${slug} Ch.${chapterFolder} hal.${page}`);
}

async function getPublicAssetBytes(key, label) {
  const bucket = process.env.R2_PUBLIC_BUCKET_NAME || process.env.R2_BUCKET_NAME;
  return getR2ObjectBytes(bucket, key, label);
}

async function getLockedPageBytes(slug, chapterFolder, page) {
  return getR2ObjectBytes(process.env.R2_LOCKED_BUCKET_NAME, pageKey(slug, chapterFolder, page), `locked ${slug} Ch.${chapterFolder} hal.${page}`);
}

// → { bytes, name } | { url } fallback CDN | null
// `page` = nomor halaman (Imagexx.webp) yang dipakai, default 1.
async function resolveFirstPage(ch, page = 1) {
  if (!ch.slug || ch.chapterNumber == null) return null;
  const chapterFolder = ch.r2Folder ?? ch.chapterNumber;
  const name = `${ch.mangaId}-ch-${ch.chapterNumber}.webp`.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!ch.isLocked) {
    const bytes = await getPublicPageBytes(ch.slug, chapterFolder, page);
    if (bytes) return { bytes, name };
    if (!CDN_BASE) return null;
    return { url: `${CDN_BASE}/${pageKey(ch.slug, chapterFolder, page)}` };
  }
  const bytes = await getLockedPageBytes(ch.slug, chapterFolder, page);
  if (!bytes) return null;
  return { bytes, name };
}

async function resolveCoverAttachment(m) {
  const name = `${m.id}-cover.webp`.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (m.coverKey) {
    const bytes = await getPublicAssetBytes(m.coverKey, `cover ${m.id}`);
    if (bytes) return { bytes, name };
  }
  if (m.coverUrl) {
    const bytes = await fetchImageBytes(m.coverUrl);
    if (bytes) return { bytes, name };
  }
  return null;
}

// Gambar notifikasi chapter baru (Discord & Facebook) — halaman 1 (default),
// halaman tertentu (Imagexx.webp), atau cover manga. Field "notif_image"
// dibaca dari meta.json CHAPTER dulu (per-chapter, lihat detectNewChapters()),
// fallback ke meta.json manga (nilai lama/manual) kalau chapter tidak set.
// ch.coverKey/ch.coverUrl diisi oleh detectNewChapters() dari manga yang
// sudah diproses applyCoverUrls().
async function resolveNotifImage(ch) {
  if (ch.notifImage === 'cover') {
    return resolveCoverAttachment({ id: ch.mangaId, coverKey: ch.coverKey, coverUrl: ch.coverUrl });
  }
  const page = Number(ch.notifImage);
  return resolveFirstPage(ch, Number.isInteger(page) && page > 0 ? page : 1);
}

// Ambil bytes gambar dari URL CDN publik — dipakai supaya Facebook TIDAK perlu
// fetch sendiri (Graph API /photos kadang gagal unduh/decode WebP dari URL
// pihak ketiga → "Missing or invalid image file", code 324/2069019, meski
// file-nya valid & ada; FB sendiri menandainya is_transient). Dengan upload
// byte langsung (multipart), gagal-fetch di sisi FB dihilangkan.
async function fetchImageBytes(url) {
  try {
    const res = await fetchT(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NuranantoBot/1.0; +https://nuranantoscans.my.id)',
        'Referer': `${SITE_URL}/`,
      },
    }, 20000);
    if (!res.ok) {
      console.warn(`⚠️  CDN gambar menolak fetch: ${res.status} ${res.statusText} (${url})`);
      return null;
    }
    const type = res.headers.get('content-type') || '';
    if (type && !type.toLowerCase().startsWith('image/')) {
      console.warn(`⚠️  CDN gambar bukan image: ${type} (${url})`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.warn(`⚠️  CDN gambar gagal di-fetch: ${e.message} (${url})`);
    return null;
  }
}

// ── Kirim notifikasi Discord untuk chapter-chapter baru ─────────────────
// Dikelompokkan per judul manga:
//  - ≤3 chapter baru  → tiap chapter jadi PESAN terpisah (biar tidak numpuk
//    jadi 1 notifikasi yang isinya banyak embed sekaligus).
//  - >3 chapter baru  → digabung jadi 1 pesan ringkas (cegah banjir notif /
//    kena rate-limit saat upload chapter massal atau backfill).
// Hanya berjalan kalau DISCORD_WEBHOOK_URL diset & ada chapter baru.
// @everyone dipasang di SETIAP pesan (tiap chapter baru selalu nge-ping).
async function sendDiscordNotifications(newChapters, webhookUrl, siteUrl) {
  if (!webhookUrl || newChapters.length === 0) return;
  const base  = siteUrl.replace(/\/$/, '');

  const logoIcon = `${base}/logo-header.webp`;
  const footer   = { text: 'Nurananto Scanlation • Update Terbaru', icon_url: logoIcon };
  // "Tombol" link teks (webhook tidak bisa button asli). Link "Diskusi" per judul
  // sudah dilepas — channel komentar per manga dihapus, diskusi dipusatkan di satu
  // server Discord.
  const linksOf = (ch) => `🌐 [Baca](${base}/${ch.mangaId})` + (ch.rawUrl ? ` · 📄 [Raw](${ch.rawUrl})` : '');

  const byManga = groupByManga(newChapters);

  // Bangun 1 embed → satu embed SELALU jadi satu pesan tersendiri (attByName
  // dibawa per-pesan, bukan digabung global) agar judul tidak pernah tercampur
  // dalam 1 notifikasi, walau embed-nya kecil dan sebenarnya muat digabung.
  const buildEmbed = async (ch, descTop) => {
    const img = await resolveNotifImage(ch);
    let image;
    const attByName = new Map();
    if (img?.bytes) {
      attByName.set(img.name, img);
      image = { url: `attachment://${img.name}` };
    } else if (img?.url) {
      const bytes = await fetchImageBytes(img.url);
      if (bytes) {
        const name = `${ch.mangaId}-ch-${ch.chapterNumber}.webp`.replace(/[^a-zA-Z0-9._-]/g, '_');
        attByName.set(name, { bytes, name });
        image = { url: `attachment://${name}` };
      }
    }
    const embed = {
      title:     ch.mangaTitle,
      url:       `${base}/${ch.mangaId}`,
      description: [descTop, linksOf(ch)].join('\n'),
      color:     0x5865F2,
      image,     // halaman 1 chapter (pengganti cover)
      footer,
      timestamp: ch.releaseDate || new Date().toISOString(),
    };
    return { embed, attByName };
  };

  // Opening beda kalau chapter ini menandai manga Tamat/Hiatus (lihat
  // isFinalChapter/isHiatusChapter di detectNewChapters).
  const openingOf = (ch, fallback) => {
    if (ch.isFinalChapter)  return `🏁 **TAMAT!** Chapter terakhir ${ch.mangaTitle} sudah rilis, baca sampai habis!`;
    if (ch.isHiatusChapter) return `⏸️ **HIATUS** — ${ch.mangaTitle} rehat sementara mulai chapter ini.`;
    return fallback;
  };

  const messages = []; // { embed, attByName } — tiap elemen = 1 pesan Discord
  for (const list of byManga.values()) {
    if (list.length > 3) {
      const ch = list[0]; // chapter terbaru = representatif (list sudah desc)
      const nums = list.map(c => c.chapterNumber);
      messages.push(await buildEmbed(ch, openingOf(ch, `📖 **${list.length} chapter baru** (Ch ${nums[nums.length - 1]}–${nums[0]})`)));
    } else {
      for (const ch of list) messages.push(await buildEmbed(ch, openingOf(ch, `📖 **${ch.chapterTitle}**`)));
    }
  }

  // Kirim satu per satu, jeda ~1.2 detik antar pesan — di bawah limit webhook
  // Discord (~5 req/2 detik) agar aman dari 429 / terdeteksi sebagai spam.
  for (let i = 0; i < messages.length; i++) {
    const { embed, attByName } = messages[i];
    const payload = {
      username: 'Nurananto Scanlation',
      content:  `@everyone${i === 0 ? '\n## 📢 Baru Saja Dirilis!' : ''}`,
      allowed_mentions: { parse: ['everyone'] },
      embeds:   [embed],
    };
    try {
      let res;
      if (attByName.size) {
        const form = new FormData();
        form.append('payload_json', JSON.stringify(payload));
        [...attByName.values()].forEach((a, idx) => form.append(`files[${idx}]`, new Blob([a.bytes], { type: 'image/webp' }), a.name));
        res = await fetchT(webhookUrl, { method: 'POST', body: form }, 30000);
      } else {
        res = await fetchT(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) console.warn(`⚠️  Discord notif gagal: ${res.status} ${await res.text()}`);
      else console.log(`🔔 Discord notifikasi terkirim (${i + 1}/${messages.length}): ${embed.title}`);
    } catch (e) {
      console.warn(`⚠️  Discord webhook error: ${e.message}`);
    }
    // Jeda antar pesan (juga sebelum retry 429 kalau Discord membalas dibatasi)
    if (i + 1 < messages.length) await new Promise(r => setTimeout(r, 1200));
  }
}

// ── Intro 1× per manga BARU ke channel #manga-list (sinopsis lengkap + cover) ──
async function sendMangaIntros(newManga, webhookUrl, siteUrl) {
  if (!webhookUrl || newManga.length === 0) return;
  const base  = siteUrl.replace(/\/$/, '');

  const messages = [];
  for (const m of newManga) {
    const links = [`🌐 [Website](${base}/${m.id})`];
    const desc = [];
    if (m.genres?.length) desc.push(`🏷️ ${m.genres.join(' · ')}`);
    if (m.synopsis)       desc.push('', (m.synopsis || '').trim());
    desc.push('', links.join('  •  '));
    const cover = m.cover; // sudah di-resolve di buildCatalog() sebelum push ke newMangaList
    messages.push({
      att: cover,
      embed: {
      author:    { name: '📚 Judul Baru di Nurananto Scanlation', url: base },
      title:     m.title,
      url:       `${base}/${m.id}`,
      description: desc.join('\n').slice(0, 4000),
      color:     0x5865F2,
      image:     cover ? { url: `attachment://${cover.name}` } : undefined,
      footer:    { text: m.rating ? `Nurananto Scanlation • ⭐ ${m.rating}` : 'Nurananto Scanlation', icon_url: `${base}/logo-header.webp` },
      },
    });
  }

  // Sinopsis panjang → kirim 1 embed per pesan (limit Discord ~6000 char/pesan
  // bila digabung; 10 sekaligus pasti ditolak). Jeda + retry 429.
  const post = ({ embed, att }) => {
    const payload = { username: 'Nurananto Scanlation', embeds: [embed] };
    if (att) {
      const form = new FormData();
      form.append('payload_json', JSON.stringify(payload));
      form.append('files[0]', new Blob([att.bytes], { type: 'image/webp' }), att.name);
      return fetchT(webhookUrl, { method: 'POST', body: form }, 30000);
    }
    return fetchT(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };
  let sent = 0;
  for (const msg of messages) {
    try {
      let res = await post(msg);
      if (res.status === 429) {
        const wait = ((await res.json().catch(() => ({}))).retry_after || 2);
        await new Promise(r => setTimeout(r, (wait + 0.5) * 1000));
        res = await post(msg); // retry sekali
      }
      if (res.ok) sent++;
      else console.warn(`⚠️  Manga-list notif gagal (${msg.embed.title}): ${res.status} ${await res.text()}`);
    } catch (e) { console.warn(`⚠️  Manga-list webhook error (${msg.embed.title}): ${e.message}`); }
    await new Promise(r => setTimeout(r, 1200)); // anti rate-limit (5 req / 2 dtk)
  }
  console.log(`📚 Intro manga-list terkirim: ${sent}/${messages.length} judul`);
}

// ── Intro manga BARU ke Facebook Page (padanan sendMangaIntros Discord) ──
// Dipanggil 1× per manga baru (sama trigger dengan newMangaList). Foto cover
// jadi gambar utama (caption clickable), fallback teks polos kalau upload
// foto gagal — sama pola dengan sendFacebookNotifications di bawah.
async function sendFacebookMangaIntros(newManga, pageId, pageToken, siteUrl) {
  if (!pageId || !pageToken || newManga.length === 0) return;
  const base = siteUrl.replace(/\/$/, '');

  let sent = 0;
  for (const m of newManga) {
    const rawDesc = (m.synopsis || '').trim();
    // Potong di batas kata (sama pola dengan shortDesc di buildIndexEntry).
    const shortDesc = rawDesc.length > 400
      ? rawDesc.slice(0, 400).replace(/\s+\S*$/, '') + '…'
      : rawDesc;

    const lines = ['📚 Manga Baru!', m.title, '', shortDesc, '', `Baca: ${base}/${m.id}`];
    if (m.mangadexUrl) lines.push(`MangaDex: ${m.mangadexUrl}`);
    if (m.rawUrl)      lines.push(`Raw: ${m.rawUrl}`);
    const message = lines.join('\n');

    try {
      let ok = false;
      const cover = m.cover; // sudah di-resolve di buildCatalog() sebelum push ke newMangaList
      if (cover) {
        try {
          const postPhoto = () => {
            const form = new FormData();
            form.append('caption', message);
            form.append('access_token', pageToken);
            form.append('source', new Blob([cover.bytes], { type: 'image/webp' }), cover.name);
            return fetchT(`https://graph.facebook.com/v21.0/${pageId}/photos`, { method: 'POST', body: form }, 45000);
          };
          let r = await postPhoto();
          if (!r.ok) {
            await new Promise(res => setTimeout(res, 2000)); // jeda sebelum retry (FB: is_transient)
            r = await postPhoto();
          }
          if (r.ok) ok = true;
          else console.warn(`⚠️  FB manga-intro photo gagal (${m.title}): ${r.status} ${await r.text()} — fallback teks`);
        } catch (e) {
          console.warn(`⚠️  FB manga-intro photo timeout/error (${m.title}): ${e.message} — fallback teks`);
        }
      }
      if (!ok) {
        const r = await fetchT(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, access_token: pageToken }),
        });
        if (r.ok) ok = true;
        else console.warn(`⚠️  FB manga-intro feed gagal (${m.title}): ${r.status} ${await r.text()}`);
      }
      if (ok) sent++;
    } catch (e) { console.warn(`⚠️  FB manga-intro error (${m.title}): ${e.message}`); }
    await new Promise(r => setTimeout(r, 1500)); // jeda antar post
  }
  console.log(`📘 Facebook manga-intro terkirim: ${sent}/${newManga.length} judul`);
}

// ── Post chapter baru ke Facebook Page (teks polos, link tanpa html) ──
// Butuh FB_PAGE_ID + FB_PAGE_TOKEN (Page Access Token long-lived).
// Sama seperti Discord: ≤3 chapter baru/judul → post terpisah per chapter;
// >3 chapter baru/judul → digabung jadi 1 post ringkas (cegah banjir feed
// saat upload chapter massal / backfill).
async function sendFacebookNotifications(newChapters, pageId, pageToken, siteUrl) {
  if (!pageId || !pageToken || newChapters.length === 0) return;
  const host = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // newChapters urut terbaru→lama per judul (chapters sudah desc dari build-catalog).
  const byManga = groupByManga(newChapters);

  // Opening beda kalau chapter ini menandai manga Tamat/Hiatus (lihat
  // isFinalChapter/isHiatusChapter di detectNewChapters).
  const openingOf = (ch, title, fallback) => {
    if (ch.isFinalChapter)  return `🏁 Chapter terakhir — TAMAT!\n${title}\nTerima kasih sudah menikmati series ini.`;
    if (ch.isHiatusChapter) return `⏸️ Masuk hiatus mulai chapter ini\n${title}\nPantau terus ya!`;
    return fallback;
  };

  const posts = []; // { title, rep, message } — tiap elemen = 1 post FB
  for (const [mangaId, list] of byManga) {
    const title = list[0].mangaTitle;
    if (list.length > 3) {
      const nums = list.map(c => c.chapterNumber);
      const ch = list[0];
      const message =
        openingOf(ch, title, `📖 ${title}\n${list.length} chapter baru (Ch ${nums[nums.length - 1]}–${nums[0]}) sudah update!`) +
        `\n\nBaca: ${host}/${mangaId}`;
      posts.push({ title, rep: ch, message });
    } else {
      for (const ch of list) {
        const message =
          openingOf(ch, title, `📖 ${title}\nChapter ${ch.chapterNumber} sudah update!`) +
          `\n\nBaca: ${host}/${mangaId}`;
        posts.push({ title, rep: ch, message });
      }
    }
  }

  let sent = 0;
  for (const { title, rep, message } of posts) {
    try {
      let ok = false;
      // Photo post → halaman 1 (Image01.webp) jadi gambar utama (caption clickable).
      // SELALU upload byte (multipart), baik gratis (fetch dari CDN) maupun locked
      // (dari R2 privat) — TIDAK mengirim `url` mentah ke FB, karena Graph API kadang
      // gagal fetch/decode WebP dari URL pihak ketiga meski file-nya valid (lihat
      // fetchImageBytes). 1× retry karena FB sering menandai kegagalan ini transient.
      // Timeout 45s: FB memproses gambar server-side, kadang >15s.
      // Dibungkus try sendiri agar timeout/error JATUH ke fallback teks, bukan ter-skip.
      const img = await resolveNotifImage(rep);
      if (img) {
        try {
          const bytes = img.bytes || (img.url ? await fetchImageBytes(img.url) : null);
          const name  = img.name || `${rep.mangaId}-ch-${rep.chapterNumber}.webp`.replace(/[^a-zA-Z0-9._-]/g, '_');
          if (bytes) {
            const postPhoto = () => {
              const form = new FormData();
              form.append('caption', message);
              form.append('access_token', pageToken);
              form.append('source', new Blob([bytes], { type: 'image/webp' }), name);
              return fetchT(`https://graph.facebook.com/v21.0/${pageId}/photos`, { method: 'POST', body: form }, 45000);
            };
            let r = await postPhoto();
            if (!r.ok) {
              await new Promise(res => setTimeout(res, 2000)); // jeda sebelum retry (FB: is_transient)
              r = await postPhoto();
            }
            if (r.ok) ok = true;
            else console.warn(`⚠️  FB photo gagal (${title}): ${r.status} ${await r.text()} — fallback teks`);
          } else {
            console.warn(`⚠️  Gagal ambil bytes gambar (${title}) — fallback teks`);
          }
        } catch (e) {
          console.warn(`⚠️  FB photo timeout/error (${title}): ${e.message} — fallback teks`);
        }
      }
      // Fallback: post teks biasa kalau tak ada gambar / photo ditolak
      if (!ok) {
        const r = await fetchT(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, access_token: pageToken }),
        });
        if (r.ok) ok = true;
        else console.warn(`⚠️  FB feed gagal (${title}): ${r.status} ${await r.text()}`);
      }
      if (ok) sent++;
    } catch (e) { console.warn(`⚠️  FB error (${title}): ${e.message}`); }
    await new Promise(r => setTimeout(r, 1500)); // jeda antar post
  }
  console.log(`📘 Facebook posting terkirim: ${sent}/${posts.length} post`);
}

// ============================================================
// Build catalog — dipecah per tahap. Tiap fungsi satu tanggung jawab;
// buildCatalog() di bawah hanya orkestrasi urutannya per manga.
// ============================================================

// Hasil build SEBELUMNYA (public/manga/<slug>.json) — dibaca SEBELUM file
// ditimpa. Dipakai untuk: deteksi manga baru (intro), deteksi chapter baru
// (notifikasi), dan rating lama saat fetch dilewati/gagal.
function readPreviousBuild(slug) {
  const prevJsonPath = path.join(outDir, `${slug}.json`);
  const isNewManga = !fs.existsSync(prevJsonPath); // manga belum pernah ada → intro 1×
  let previousCatalog = null;
  let prevChapterNums = new Set();
  if (!isNewManga) {
    try {
      previousCatalog = JSON.parse(fs.readFileSync(prevJsonPath, 'utf-8'));
      prevChapterNums = new Set((previousCatalog.chapters || []).map(c => c.chapter_number));
    } catch {}
  }
  return { isNewManga, previousCatalog, prevChapterNums };
}

// Rating MangaDex — fetch hanya untuk manga yang berubah di push ini; manga lain
// pakai rating hasil build sebelumnya (refresh penuh terjadi saat cron mingguan).
async function resolveRating(manga, isChanged, previousCatalog) {
  if (manga.mangadex_id && isChanged) {
    console.log(`📡 Fetching rating for ${manga.title}...`);
    manga.rating = await fetchMangaDexRating(manga.mangadex_id);
    if (manga.rating) {
      manga.rating = Math.round(manga.rating * 100) / 100; // 2 desimal (x.xx)
      console.log(`   ⭐ ${manga.rating}`);
    } else if (previousCatalog?.rating != null) {
      manga.rating = previousCatalog.rating;
      console.log(`   ♻️  Rating gagal diambil; pakai rating lama (${manga.rating})`);
    }
  } else if (manga.mangadex_id && previousCatalog) {
    manga.rating = previousCatalog.rating ?? null;
    console.log(`♻️  ${manga.title} — rating lama dipakai (${manga.rating ?? '—'})`);
  } else {
    manga.rating = null;
  }
}

// Baca semua folder chapter satu manga → daftar chapter lengkap (id, unlockDate,
// isLocked, views, dst). Menulis balik release_date ke meta chapter bila belum
// ada, dan mengembalikan daftar lock Early Access untuk sync ke Worker.
function buildChapters(slug, mangaPath, manga) {
  const chapters = [];
  const protectedChapters = [];
  for (const entry of fs.readdirSync(mangaPath)) {
    const chapterPath = path.join(mangaPath, entry);
    if (!fs.statSync(chapterPath).isDirectory()) continue;
    const chMetaPath = path.join(chapterPath, 'meta.json');
    if (!fs.existsSync(chMetaPath)) continue;
    const ch = fixEncoding(JSON.parse(fs.readFileSync(chMetaPath, 'utf-8')));
    const forceNotify = ch.republish_notification === true;
    if (forceNotify) {
      delete ch.republish_notification;
      Object.defineProperty(ch, '_forceNotify', { value: true, enumerable: false });
      try {
        const raw = JSON.parse(fs.readFileSync(chMetaPath, 'utf-8'));
        delete raw.republish_notification;
        fs.writeFileSync(chMetaPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
        console.log(`   🔁 ${slug} Ch.${ch.chapter_number} dijadwalkan publish ulang`);
      } catch {}
    }

    // pages wajib diisi
    if (!ch.pages || ch.pages < 1) {
      console.warn(`⚠️  SKIP ${slug} Ch.${ch.chapter_number}: field "pages" wajib diisi!`);
      continue;
    }

    // Auto-generate id, title, dan r2_prefix
    const isOneshot = manga.status === 'Oneshot';
    const chapterNumber = isOneshot ? 'oneshot' : ch.chapter_number;
    const r2Folder = isOneshot ? entry : chapterNumber;
    ch.chapter_number = chapterNumber;
    ch.r2_folder = r2Folder;
    ch.id = `${slug}-ch-${chapterNumber}`;
    ch.r2_prefix = `manga/${slug}/${r2Folder}/`;
    if (!ch.title) {
      ch.title = isOneshot ? 'Oneshot' : `Ch. ${chapterNumber}`;
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

    // Override eksplisit dipakai untuk penjadwalan hingga detik tanpa mengubah
    // release_date asli. Jika tidak ada, tetap gunakan release + lock_hours.
    const explicitUnlockDate = ch.unlock_date;
    delete ch.unlock_date;
    if (explicitUnlockDate) {
      const unlockMs = new Date(explicitUnlockDate).getTime();
      if (!Number.isFinite(unlockMs)) {
        throw new Error(`${slug} Ch.${ch.chapter_number}: unlock_date tidak valid`);
      }
      ch.unlockDate = new Date(unlockMs).toISOString();
    } else if (ch.lock_hours === -1) {
      // Lock permanen — tidak ada timer, buka manual lewat meta.json.
      ch.unlockDate = FOREVER_UNLOCK_DATE;
    } else if (ch.lock_hours > 0) {
      const unlockDate = new Date(ch.release_date);
      unlockDate.setHours(unlockDate.getHours() + ch.lock_hours);
      ch.unlockDate = unlockDate.toISOString();
    } else {
      ch.unlockDate = null;
    }

    // isLocked: terkunci kalau unlockDate masih di masa depan
    ch.isLocked = ch.unlockDate ? new Date(ch.unlockDate) > new Date() : false;
    // Hanya ada dua fase: Early Access hingga unlockDate, lalu langsung publik.
    if (ch.unlockDate && new Date(ch.unlockDate).getTime() > Date.now()) {
      protectedChapters.push({ chapter_id: ch.id, unlock_at: ch.unlockDate });
    }

    // isNew dihitung di frontend dari release_date (bukan disimpan di catalog)

    // Views per chapter dari manga meta.json (field chapter_views)
    ch.views = (manga.chapter_views ?? {})[String(ch.chapter_number)] ?? 0;

    chapters.push(ch);
  }

  // Urutkan chapter: terbaru di atas (descending)
  chapters.sort((a, b) => chapterSortValue(b.chapter_number) - chapterSortValue(a.chapter_number));
  return { chapters, protectedChapters };
}

// coverUrl/coverUrls via CDN + cache-busting ?v=<cover_version>, dan galeri
// SEMUA cover (terbaru duluan). Menghapus field internal cover_dev.
function applyCoverUrls(manga) {
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
}

// Tulis detail lengkap per manga → public/manga/<slug>.json (di-fetch halaman detail).
function writeMangaDetailJson(slug, manga, chapters) {
  fs.mkdirSync(outDir, { recursive: true });
  const publicManga = { ...manga, chapters };
  // Watermark internal cron hanya diperlukan di meta sumber GitHub. Jangan
  // ikut mempublikasikan detail sinkronisasi Worker ke katalog frontend.
  delete publicManga.view_sync_cutoff;
  fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify(publicManga, null, 2), 'utf-8');
}

// Entri index.json — hanya field yang DIPAKAI homepage (kartu, search, carousel)
// + 3 chapter terbaru. Field detail-only (description penuh, alt_title, covers,
// author, type) sengaja TIDAK disertakan — sudah ada di per-manga JSON.
// description RINGKAS (~300 char) untuk FeaturedCarousel; potong di batas kata.
function buildIndexEntry(manga, chapters, latestReleaseDate) {
  const rawDesc = manga.description || '';
  const shortDesc = rawDesc.length > 300
    ? rawDesc.slice(0, 300).replace(/\s+\S*$/, '') + '…'
    : rawDesc;
  return {
    id:           manga.id,
    title:        manga.title,
    description:  shortDesc,
    status:       manga.status,
    coverUrl:     manga.coverUrl,
    coverUrls:    manga.coverUrls,
    genres:       manga.genres,
    rating:       manga.rating,
    chapter_count: chapters.length,
    total_views:  manga.total_views,
    isTrending:   manga.isTrending,
    latest_release_date: latestReleaseDate,
    next_update:  manga.next_update,
    tamat_at_chapter:  manga.tamat_at_chapter ?? null,
    hiatus_at_chapter: manga.hiatus_at_chapter ?? null,
    chapters:     chapters.slice(0, 3),
  };
}

// Chapter BARU (belum ada di build sebelumnya, atau ditandai publish ulang) —
// hanya saat push spesifik (CHANGED_SLUGS), bukan full cron build.
function detectNewChapters(slug, manga, chapters, prevChapterNums) {
  const found = [];
  if (!(CHANGED_SLUGS.length > 0 && CHANGED_SLUGS.includes(slug))) return found;
  for (const ch of chapters) {
    if (!prevChapterNums.has(ch.chapter_number) || ch._forceNotify) {
      found.push({
        mangaId:          manga.id,
        mangaTitle:       manga.title,
        slug,                         // path R2: manga/<slug>/<chapter>/Image01.webp
        chapterNumber:    ch.chapter_number,
        r2Folder:         ch.r2_folder,
        chapterTitle:     ch.title,
        isLocked:         ch.isLocked,
        releaseDate:      ch.release_date,
        // Chapter penutup (Tamat) / awal rehat (Hiatus) — ditandai manual via
        // tamat_at_chapter / hiatus_at_chapter di meta.json manga, dipakai untuk
        // opening pesan notif Discord/Facebook yang beda dari update biasa.
        isFinalChapter:   manga.status === 'Tamat'  && String(manga.tamat_at_chapter  ?? '') === String(ch.chapter_number),
        isHiatusChapter:  manga.status === 'Hiatus' && String(manga.hiatus_at_chapter ?? '') === String(ch.chapter_number),
        // Gambar notifikasi: prioritas notif_image CHAPTER, fallback ke manga, lalu 'page1'.
        notifImage:       ch.notif_image || manga.notif_image || 'page1',
        coverKey:         manga.cover_dev ?? manga.covers?.[0],
        coverUrl:         manga.coverUrl,
        rawUrl:           manga.raw_url,
      });
      console.log(`   🔔 ${ch._forceNotify ? 'Publish ulang' : 'Chapter baru terdeteksi'}: ${manga.title} — ${ch.title}`);
    }
  }
  return found;
}

// Urutkan homepage (update terbaru di atas), tandai trending fallback build-time
// (5 update terbaru — ranking utama tetap /api/trending), tulis index.json.
function writeIndexJson(catalog) {
  catalog.sort((a, b) => {
    const byDate = releaseSortValue(b.latest_release_date) - releaseSortValue(a.latest_release_date);
    if (byDate !== 0) return byDate;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });

  const trendingIds = new Set(catalog.slice(0, 5).map(m => m.id));
  catalog.forEach(m => { m.isTrending = trendingIds.has(m.id); });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(catalog, null, 2), 'utf-8');

  console.log(`\n📦 index.json: ${catalog.length} manga`);
  console.log(`🔥 Trending: ${[...trendingIds].join(', ')}`);
}

// Sync lock Early Access ke Worker (D1 chapter_locks) — retry 3×; kalau tetap
// gagal, build DIBATALKAN supaya catalog yang mengira chapter terkunci tidak
// dideploy tanpa lock di sisi server (chapter bisa bocor).
async function syncChapterLocks(locks) {
  const workerUrl   = process.env.WORKER_URL;
  const adminSecret = process.env.WORKER_ADMIN_SECRET;
  if (!workerUrl || !adminSecret || !locks.length) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetchT(`${workerUrl}/api/admin/sync-locks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ locks }),
      });
      if (res.ok) {
        console.log(`🔒 Synced ${locks.length} locks → Worker OK (attempt ${attempt})`);
        return;
      }
      console.warn(`⚠️  Attempt ${attempt}: ${await res.text()}`);
    } catch (e) {
      console.warn(`⚠️  Attempt ${attempt}: ${e.message}`);
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
  }
  console.error('❌ Lock sync gagal 3x — batalkan deploy agar chapter tidak bocor!');
  process.exit(1);
}

async function buildCatalog() {
  const catalog = [];
  const protectedChapters = [];
  const newChaptersList = []; // dikumpulkan untuk notifikasi Discord
  const newMangaList    = []; // manga BARU (intro 1× ke #manga-list)

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

    // Hasil build lama HARUS dibaca sebelum writeMangaDetailJson menimpanya.
    const { isNewManga, previousCatalog, prevChapterNums } = readPreviousBuild(slug);
    const isChanged = CHANGED_SLUGS.length === 0 || CHANGED_SLUGS.includes(slug);
    await resolveRating(manga, isChanged, previousCatalog);

    manga.status = normalizeStatus(manga.status);
    manga.type   = normalizeType(manga.type);

    const { chapters, protectedChapters: mangaLocks } = buildChapters(slug, mangaPath, manga);
    protectedChapters.push(...mangaLocks);

    const recentChapters = [...chapters].sort(compareRecentChapters);
    const latestReleaseDate = recentChapters[0]?.release_date ?? null;

    // Total views manga = jumlah view semua chapter + view halaman detail
    // (detail_views diakumulasi cron dari /api/view/<slug> tanpa "-ch-").
    manga.total_views = chapters.reduce((sum, ch) => sum + ch.views, 0) + (manga.detail_views ?? 0);

    // next_update diambil dari chapter terbaru (chapters sudah diurutkan desc)
    manga.next_update = chapters[0]?.next_update ?? null;

    // Urutkan genre abjad
    if (Array.isArray(manga.genres)) manga.genres.sort();

    applyCoverUrls(manga);
    writeMangaDetailJson(slug, manga, chapters);

    // Manga BARU (belum pernah ada JSON-nya) → intro 1× ke #manga-list + FB.
    // MANGALIST_BACKFILL=1 → kirim SEMUA manga (sekali, untuk isi channel kosong).
    // SENGAJA nunggu cover BENAR-BENAR bisa diunduh (bukan cuma field covers[0]
    // terisi) — manga baru sering meta.json-nya sudah di-push duluan sebelum
    // sync-covers.js berhasil dapat cover dari MangaDex (mis. judul belum
    // terindeks / mangadex_url belum diisi), jadi kalau dipaksa kirim sekarang
    // hasilnya post tanpa gambar. intro_pending ditulis balik ke meta.json
    // SUMBER supaya build berikutnya otomatis coba lagi sampai cover ketemu —
    // tanpa ini, begitu isNewManga jadi false (JSON sudah pernah ditulis),
    // intro-nya hilang permanen walau cover-nya nanti akhirnya ada.
    if (isNewManga || manga.intro_pending === true || MANGALIST_BACKFILL) {
      const cover = await resolveCoverAttachment({
        id:       manga.id,
        coverKey: manga.covers?.[0],
        coverUrl: manga.coverUrl,
      });
      if (cover) {
        newMangaList.push({
          id:          manga.id,
          title:       manga.title,
          cover,
          genres:      manga.genres,
          rating:      manga.rating,
          synopsis:    manga.description,
          mangadexUrl: manga.mangadex_url,
          rawUrl:      manga.raw_url,
        });
        if (manga.intro_pending) {
          delete manga.intro_pending;
          try {
            const raw = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            delete raw.intro_pending;
            fs.writeFileSync(metaPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
          } catch {}
        }
      } else if (!MANGALIST_BACKFILL) {
        console.warn(`   ⏳ ${manga.title}: cover belum tersedia, intro ditunda ke build berikutnya`);
        if (!manga.intro_pending) {
          manga.intro_pending = true;
          try {
            const raw = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            raw.intro_pending = true;
            fs.writeFileSync(metaPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
          } catch {}
        }
      }
    }

    catalog.push(buildIndexEntry(manga, chapters, latestReleaseDate));
    newChaptersList.push(...detectNewChapters(slug, manga, chapters, prevChapterNums));

    console.log(`✅ ${manga.title} — ${chapters.length} chapters`);
  }

  writeIndexJson(catalog);
  await syncChapterLocks(protectedChapters);

  // Notifikasi Discord untuk chapter-chapter baru
  await sendDiscordNotifications(newChaptersList, DISCORD_WEBHOOK_URL, SITE_URL);
  await sendMangaIntros(newMangaList, DISCORD_MANGALIST_WEBHOOK_URL, SITE_URL);
  await sendFacebookMangaIntros(newMangaList, FB_PAGE_ID, FB_PAGE_TOKEN, SITE_URL);
  await sendFacebookNotifications(newChaptersList, FB_PAGE_ID, FB_PAGE_TOKEN, SITE_URL);
}

buildCatalog().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
