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
// Penanda versi ukuran — kalau berubah, semua cover di-generate ulang otomatis
const SIZE_SIGNATURE = SIZES.map(s => s.width).join('x');

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
// semua cover. Dipakai saat pindah bucket (cover belum ada di bucket baru).
const FORCE = process.env.FORCE_COVER_RESYNC === '1';

// Cover utama (yang ditandai MangaDex sebagai cover_art manga)
async function getMangaDexCover(mangadexId) {
  try {
    const res = await fetch(`https://api.mangadex.org/manga/${mangadexId}?includes[]=cover_art`);
    if (!res.ok) return null;
    const data = await res.json();
    const rel = data.data?.relationships?.find(r => r.type === 'cover_art');
    return rel?.attributes?.fileName || null;
  } catch {
    return null;
  }
}

// Semua cover manga di MangaDex (untuk galeri) — urut volume naik
async function getAllMangaDexCovers(mangadexId) {
  try {
    const res = await fetch(`https://api.mangadex.org/cover?manga[]=${mangadexId}&limit=100&order[createdAt]=asc`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .map(c => ({ file: c.attributes?.fileName, volume: c.attributes?.volume ?? null }))
      .filter(c => c.file);
  } catch {
    return [];
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
  const res = await fetch(`https://uploads.mangadex.org/covers/${mangadexId}/${fileName}`);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function resizeAndUpload(buffer, keyBase) {
  const keys = [];
  for (const { suffix, width } of SIZES) {
    const key = `${keyBase}${suffix}.webp`;
    const out = await sharp(buffer)
      .resize(width, null, { withoutEnlargement: true })
      .webp({ quality: 85 })
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
    const metaPath = path.join(MANGA_DIR, slug, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.mangadex_url) {
      console.log(`⏭  ${slug}: tidak ada mangadex_url, skip`);
      skipped++;
      continue;
    }

    const match = meta.mangadex_url.match(/\/title\/([a-f0-9-]{36})/);
    if (!match) continue;
    const mangadexId = match[1];

    console.log(`🔍 ${meta.title || slug}`);
    let metaChanged = false;

    // Ambil semua cover dulu — dipakai untuk galeri DAN memilih cover utama
    const allCovers = await getAllMangaDexCovers(mangadexId);

    // ── Cover utama = volume TERTINGGI (bukan pilihan MangaDex) ─
    // Fallback: cover_art pilihan MangaDex kalau tidak ada info volume
    let coverFileName = null;
    const numbered = allCovers.filter(c => c.volume != null && !isNaN(parseFloat(c.volume)));
    if (numbered.length) {
      coverFileName = numbered.reduce((a, b) => parseFloat(b.volume) >= parseFloat(a.volume) ? b : a).file;
    } else if (allCovers.length) {
      coverFileName = allCovers[allCovers.length - 1].file; // terbaru (urut createdAt)
    } else {
      coverFileName = await getMangaDexCover(mangadexId);
    }
    if (!coverFileName) {
      console.log(`   ⚠️  Tidak dapat cover dari MangaDex`);
    } else if (!FORCE && meta.mangadex_cover === coverFileName && meta.covers?.length >= 3 && meta.cover_widths === SIZE_SIGNATURE) {
      console.log(`   ✓ Cover utama sudah terbaru (${coverFileName})`);
    } else {
      console.log(`   📥 Cover utama baru: ${coverFileName}`);
      const imgBuffer = await downloadCover(mangadexId, coverFileName);
      if (imgBuffer) {
        // Hapus cover utama lama dari R2
        for (const oldKey of meta.covers || []) {
          await deleteFromR2(oldKey);
        }
        meta.covers         = await resizeAndUpload(imgBuffer, `manga/${slug}/covers/cover`);
        meta.mangadex_cover = coverFileName;
        meta.cover_widths   = SIZE_SIGNATURE;
        metaChanged = true;
        console.log(`   ✅ Cover utama terupload (${SIZE_SIGNATURE})`);
      } else {
        console.log(`   ❌ Gagal download cover utama`);
      }
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
        if (!FORCE && existing && existing.widths === SIZE_SIGNATURE) {
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
