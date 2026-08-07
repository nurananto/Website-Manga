import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const MANGA_DIR = './manga';
// Lebar 4× ukuran tampil agar sangat tajam di layar high-DPI
const SIZES = [
  { suffix: '',        width: 1280 }, // desktop
  { suffix: '@tablet', width: 960 },  // tablet
  { suffix: '@mobile', width: 640 },  // mobile
];
// q85 menghasilkan cover mobile ~80 KB — berat untuk elemen LCP. Diukur pada
// cover asli: q75 memangkas ~33% (80 KB -> 54 KB di 640px) dan di bawah q75
// penghematannya mendatar (q70 hanya 51 KB), jadi 75 adalah titik beloknya.
// effort 6 menekan ukuran lebih jauh pada kualitas sama; ongkosnya hanya waktu CI.
const WEBP_QUALITY = 75;
const WEBP_EFFORT  = 6;
// Penanda versi ukuran — kalau berubah, semua cover di-generate ulang otomatis.
// Kualitas ikut disertakan: tanpa itu, perubahan angka di atas tidak akan pernah
// menyentuh cover yang terlanjur ada karena penjaga di bawah hanya cek lebar.
const SIZE_SIGNATURE = `${SIZES.map(s => s.width).join('x')}q${WEBP_QUALITY}`;

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
// Bucket publik khusus aset (cover) — fallback ke bucket utama jika belum diset
const BUCKET = process.env.R2_PUBLIC_BUCKET_NAME || process.env.R2_BUCKET_NAME;

// FORCE_COVER_RESYNC=1 → abaikan cache "sudah up to date", download & upload ulang
// SEMUA cover. Dipakai saat pindah bucket (cover belum ada di bucket baru).
const FORCE = process.env.FORCE_COVER_RESYNC === '1';
// FORCE_COVER_SLUG="Waka-chan,Slug2" → force hanya manga tertentu (folder hilang).
const FORCE_SLUGS = new Set(
  (process.env.FORCE_COVER_SLUG || '').split(',').map(s => s.trim()).filter(Boolean)
);
// CHANGED_SLUGS (dari workflow) → hanya sync cover manga yang berubah di push ini,
// hindari ~46 call MangaDex tiap push. Kosong = full scan (cron mingguan / dispatch).
const CHANGED_SLUGS = new Set(
  (process.env.CHANGED_SLUGS || '').split(',').map(s => s.trim()).filter(Boolean)
);

// fetch dengan timeout — cegah Action menggantung kalau MangaDex lambat/down.
async function fetchT(url, options = {}, ms = 15000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Cover utama (yang ditandai MangaDex sebagai cover_art manga)
async function getMangaDexCover(mangadexId) {
  try {
    const res = await fetchT(`https://api.mangadex.org/manga/${mangadexId}?includes[]=cover_art`);
    if (!res.ok) return null;
    const data = await res.json();
    const rel = data.data?.relationships?.find(r => r.type === 'cover_art');
    return rel?.attributes?.fileName || null;
  } catch {
    return null;
  }
}

// Bahasa asli manga (ja/ko/zh...) — untuk memilih cover dengan locale yang benar
async function getOriginalLanguage(mangadexId) {
  try {
    const res = await fetchT(`https://api.mangadex.org/manga/${mangadexId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.attributes?.originalLanguage || null;
  } catch {
    return null;
  }
}

// Semua cover manga di MangaDex (untuk galeri) — urut volume naik
async function getAllMangaDexCovers(mangadexId) {
  try {
    const res = await fetchT(`https://api.mangadex.org/cover?manga[]=${mangadexId}&limit=100&order[createdAt]=asc`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .map(c => ({ file: c.attributes?.fileName, volume: c.attributes?.volume ?? null, locale: c.attributes?.locale ?? null }))
      .filter(c => c.file);
  } catch {
    return [];
  }
}

// Fallback cover dari raw_url — dipakai HANYA saat MangaDex belum punya cover
// (manga baru sering di-push sebelum terindeks MangaDex). Ambil og:image /
// twitter:image dari HTML halaman raw (bookwalker.jp, comic-walker.com, dst
// sudah dicek pakai tag ini). Generik lintas situs, bukan scraper khusus 1
// domain — kalau situsnya tidak set meta tag ini, fallback gagal (aman, skip).
async function fetchOgImage(pageUrl) {
  try {
    const res = await fetchT(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NurantoScansCoverBot/1.0)' },
    }, 15000);
    if (!res.ok) return null;
    const html = await res.text();
    // property/content bisa muncul di urutan mana pun di dalam tag <meta>.
    const grab = (attrName, attrValue) => {
      const re = new RegExp(
        `<meta[^>]*(?:${attrName}=["']${attrValue}["'][^>]*content=["']([^"']+)["']` +
        `|content=["']([^"']+)["'][^>]*${attrName}=["']${attrValue}["'])[^>]*>`,
        'i'
      );
      const m = html.match(re);
      return m ? (m[1] || m[2]) : null;
    };
    return grab('property', 'og:image') || grab('name', 'twitter:image');
  } catch {
    return null;
  }
}

async function downloadImageUrl(url) {
  try {
    const res = await fetchT(url, {}, 25000);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function uploadToR2(key, buffer) {
  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: 'image/webp',
  }));
}

async function deleteFromR2(key) {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {}
}

async function downloadCover(mangadexId, fileName) {
  try {
    const res = await fetchT(`https://uploads.mangadex.org/covers/${mangadexId}/${fileName}`, {}, 25000);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null; // timeout/network → skip cover (pakai yang lama)
  }
}

async function resizeAndUpload(buffer, keyBase) {
  const keys = [];
  for (const { suffix, width } of SIZES) {
    const key = `${keyBase}${suffix}.webp`;
    const out = await sharp(buffer)
      .resize(width, null, { withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toBuffer();
    await uploadToR2(key, out);
    keys.push(key);
  }
  return keys;
}

async function syncCovers() {
  const required = ['CF_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (!BUCKET) missing.push('R2_PUBLIC_BUCKET_NAME / R2_BUCKET_NAME');
  if (missing.length) {
    console.error(`❌ Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const slugs = fs.readdirSync(MANGA_DIR).filter(f =>
    fs.statSync(path.join(MANGA_DIR, f)).isDirectory()
  );

  let updated = 0;
  let skipped = 0;

  for (const slug of slugs) {
    // Lewati manga yang TIDAK berubah di push ini (kecuali full scan / force).
    // Hemat call MangaDex: incremental push cuma cek manga yang disentuh.
    if (CHANGED_SLUGS.size > 0 && !CHANGED_SLUGS.has(slug) && !FORCE && !FORCE_SLUGS.has(slug)) {
      continue;
    }

    const metaPath = path.join(MANGA_DIR, slug, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.mangadex_url && !meta.raw_url) {
      console.log(`⏭  ${slug}: tidak ada mangadex_url maupun raw_url, skip`);
      skipped++;
      continue;
    }

    const mdxMatch    = meta.mangadex_url?.match(/\/title\/([a-f0-9-]{36})/);
    const mangadexId  = mdxMatch?.[1] || null;

    // Force global (semua) atau hanya slug yang diminta (folder hilang).
    const force = FORCE || FORCE_SLUGS.has(slug);

    console.log(`🔍 ${meta.title || slug}${force ? ' (FORCE)' : ''}`);
    let metaChanged = false;

    // Ambil semua cover dulu — dipakai untuk galeri DAN memilih cover utama.
    // Kosong kalau manga belum punya mangadex_url (murni raw_url) — galeri
    // otomatis jadi no-op untuk kasus itu, wajar karena raw_url tidak punya
    // konsep "semua cover per volume" yang bisa di-scrape generik.
    const allCovers = mangadexId ? await getAllMangaDexCovers(mangadexId) : [];

    // ── Cover utama = volume TERTINGGI dari LOCALE bahasa asli manga ─
    // Cegah cover bahasa lain (mis. terjemahan Vietnam) terpilih hanya karena
    // di-upload paling baru. Prioritas: cover ber-locale == originalLanguage;
    // kalau tidak ada, pakai semua cover (perilaku lama).
    let coverFileName = null;
    if (mangadexId) {
      const origLang = await getOriginalLanguage(mangadexId);
      const sameLocale = origLang ? allCovers.filter(c => c.locale === origLang) : [];
      const pool = sameLocale.length ? sameLocale : allCovers;
      if (origLang) {
        console.log(`   🌐 Bahasa asli: ${origLang} — ${sameLocale.length}/${allCovers.length} cover cocok locale`);
      }

      const numbered = pool.filter(c => c.volume != null && !isNaN(parseFloat(c.volume)));
      if (numbered.length) {
        coverFileName = numbered.reduce((a, b) => parseFloat(b.volume) >= parseFloat(a.volume) ? b : a).file;
      } else if (pool.length) {
        coverFileName = pool[pool.length - 1].file; // terbaru (urut createdAt)
      } else {
        coverFileName = await getMangaDexCover(mangadexId);
      }
    }

    if (coverFileName) {
      // MangaDex tersedia → sumber utama, prioritas di atas raw_url. Perbandingan
      // meta.mangadex_cover === coverFileName otomatis FALSE kalau cover
      // sebelumnya berasal dari raw_url (field itu tidak pernah diisi di jalur
      // raw) — jadi transisi raw → MangaDex jalan otomatis tanpa flag tambahan.
      if (!force && meta.mangadex_cover === coverFileName && meta.covers?.length >= 3 && meta.cover_widths === SIZE_SIGNATURE) {
        console.log(`   ✓ Cover utama sudah terbaru (${coverFileName})`);
      } else {
        console.log(`   📥 Cover utama baru dari MangaDex: ${coverFileName}`);
        const imgBuffer = await downloadCover(mangadexId, coverFileName);
        if (imgBuffer) {
          for (const oldKey of meta.covers || []) await deleteFromR2(oldKey);
          meta.covers         = await resizeAndUpload(imgBuffer, `manga/${slug}/covers/cover`);
          meta.mangadex_cover = coverFileName;
          meta.cover_source   = 'mangadex';
          delete meta.raw_cover_url; // sisa dari jalur raw_url, sudah tidak relevan
          meta.cover_widths   = SIZE_SIGNATURE;
          // Bump versi → URL cover.webp?v=N berubah → bust cache CDN/Discord/browser.
          // Tanpa ini, cover R2 diganti tapi URL sama → cache lama tetap tampil.
          meta.cover_version  = (Number.isFinite(meta.cover_version) ? meta.cover_version : 1) + 1;
          metaChanged = true;
          console.log(`   ✅ Cover utama terupload dari MangaDex (${SIZE_SIGNATURE})`);
        } else {
          console.log(`   ❌ Gagal download cover utama dari MangaDex`);
        }
      }
    } else if (meta.raw_url && (!meta.covers?.length || meta.cover_source === 'raw')) {
      // Fallback raw_url — HANYA kalau MangaDex belum punya cover (belum
      // terindeks / mangadex_url belum diisi) DAN manga ini memang belum
      // punya cover sama sekali, atau cover yang ada sekarang juga dari
      // raw_url (biar tetap dicek/diupdate tiap sync). Manga yang sudah
      // punya cover manual/mangadex tidak pernah disentuh jalur ini.
      console.log(`   🔗 MangaDex belum ada cover, coba fallback raw_url: ${meta.raw_url}`);
      const ogImageUrl = await fetchOgImage(meta.raw_url);
      if (!ogImageUrl) {
        console.log(`   ⚠️  Gagal ambil og:image/twitter:image dari raw_url`);
      } else if (!force && meta.raw_cover_url === ogImageUrl && meta.covers?.length >= 3 && meta.cover_widths === SIZE_SIGNATURE) {
        console.log(`   ✓ Cover dari raw_url sudah terbaru`);
      } else {
        console.log(`   📥 Cover baru dari raw_url: ${ogImageUrl}`);
        const imgBuffer = await downloadImageUrl(ogImageUrl);
        if (!imgBuffer) {
          console.log(`   ❌ Gagal download cover dari raw_url`);
        } else {
          // Sanity check rasio — og:image beda-beda kualitasnya antar situs raw:
          // bookwalker.jp biasanya cover asli (portrait, ~0.7), tapi comic-walker.com
          // dkk kadang malah kasih banner promosi LANDSCAPE (terverifikasi manual,
          // 960x540) yang bakal kepotong parah kalau dipaksa ke slot cover portrait.
          // Tolak apa pun yang bukan jelas-jelas portrait, biar tidak upload cover
          // yang salah bentuk — lebih baik nunggu MangaDex/cover manual.
          const dims = await sharp(imgBuffer).metadata().catch(() => null);
          const ratio = dims?.width && dims?.height ? dims.width / dims.height : null;
          if (!ratio || ratio > 0.9) {
            console.log(`   ⚠️  og:image bukan portrait (${dims?.width}x${dims?.height}, rasio ${ratio?.toFixed(2) ?? '?'}) — kemungkinan bukan cover asli, dilewati`);
          } else {
            for (const oldKey of meta.covers || []) await deleteFromR2(oldKey);
            meta.covers        = await resizeAndUpload(imgBuffer, `manga/${slug}/covers/cover`);
            meta.raw_cover_url = ogImageUrl;
            meta.cover_source  = 'raw';
            delete meta.mangadex_cover; // pastikan nanti ke-detect beda begitu MangaDex ada cover
            meta.cover_widths  = SIZE_SIGNATURE;
            meta.cover_version = (Number.isFinite(meta.cover_version) ? meta.cover_version : 1) + 1;
            metaChanged = true;
            console.log(`   ✅ Cover utama terupload dari raw_url (sementara, akan diganti MangaDex kalau sudah tersedia)`);
          }
        }
      }
    } else if (!mangadexId) {
      console.log(`   ⚠️  Tidak ada mangadex_url dan raw_url tidak dipakai (cover sudah ada, dianggap manual)`);
    } else {
      console.log(`   ⚠️  Tidak dapat cover dari MangaDex, dan tidak ada raw_url sebagai fallback`);
    }

    // ── Galeri: semua cover MangaDex, sinkron dua arah ─────────
    if (allCovers.length) {
      const prev         = Array.isArray(meta.cover_gallery) ? meta.cover_gallery : [];
      const prevByFile   = Object.fromEntries(prev.map(g => [g.file, g]));
      const currentFiles = new Set(allCovers.map(c => c.file));
      const gallery      = [];

      // Hapus yang sudah tidak ada di MangaDex
      for (const g of prev) {
        if (!currentFiles.has(g.file)) {
          for (const k of g.keys || []) await deleteFromR2(k);
          console.log(`   🗑  Galeri: hapus ${g.file} (tidak ada lagi di MangaDex)`);
          metaChanged = true;
        }
      }

      // Tambah/regenerasi yang baru atau beda ukuran
      for (const c of allCovers) {
        const existing = prevByFile[c.file];
        if (!force && existing && existing.widths === SIZE_SIGNATURE) {
          gallery.push({ ...existing, volume: c.volume });
          continue;
        }
        const buf = await downloadCover(mangadexId, c.file);
        if (!buf) {
          if (existing) gallery.push(existing);
          console.log(`   ❌ Galeri: gagal download ${c.file}`);
          continue;
        }
        const base = c.file.replace(/\.[a-z0-9]+$/i, '');
        const keys = await resizeAndUpload(buf, `manga/${slug}/covers/gallery/${base}`);
        gallery.push({ file: c.file, volume: c.volume, keys, widths: SIZE_SIGNATURE });
        metaChanged = true;
        console.log(`   🖼  Galeri: upload ${c.file}${c.volume ? ` (Vol. ${c.volume})` : ''}`);
      }

      if (JSON.stringify(meta.cover_gallery ?? null) !== JSON.stringify(gallery)) {
        meta.cover_gallery = gallery;
        metaChanged = true;
      }
    }

    if (metaChanged) {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
      console.log(`   💾 meta.json diperbarui`);
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\n📦 Selesai — ${updated} diperbarui, ${skipped} di-skip`);
}

syncCovers().catch(err => {
  console.error('❌ Cover sync gagal:', err);
  process.exit(1);
});
