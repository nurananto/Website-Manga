import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const MANGA_DIR = './manga';
// Lebar 2× ukuran tampil agar tajam di layar high-DPI (retina/ponsel)
const SIZES = [
  { suffix: '',        width: 640 }, // desktop
  { suffix: '@tablet', width: 480 }, // tablet
  { suffix: '@mobile', width: 320 }, // mobile
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

async function syncCovers() {
  const required = ['CF_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
  const missing = required.filter(k => !process.env[k]);
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
    const coverFileName = await getMangaDexCover(mangadexId);
    if (!coverFileName) {
      console.log(`   ⚠️  Tidak dapat cover dari MangaDex`);
      skipped++;
      continue;
    }

    // Sudah up to date (cover sama + ukuran sama) — skip
    if (meta.mangadex_cover === coverFileName && meta.covers?.length >= 3 && meta.cover_widths === SIZE_SIGNATURE) {
      console.log(`   ✓ Cover sudah terbaru (${coverFileName})`);
      skipped++;
      continue;
    }

    console.log(`   📥 Cover baru terdeteksi: ${coverFileName}`);

    // Download dari MangaDex
    const imgRes = await fetch(`https://uploads.mangadex.org/covers/${mangadexId}/${coverFileName}`);
    if (!imgRes.ok) {
      console.log(`   ❌ Gagal download cover (${imgRes.status})`);
      continue;
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // Hapus cover lama dari R2
    if (meta.covers?.length) {
      for (const oldKey of meta.covers) {
        await deleteFromR2(oldKey);
        console.log(`   🗑  Hapus lama: ${oldKey}`);
      }
    }

    // Resize + upload 3 ukuran
    const newCovers = [];
    for (const { suffix, width } of SIZES) {
      const r2Key = `manga/${slug}/covers/cover${suffix}.webp`;
      const buf = await sharp(imgBuffer)
        .resize(width, null, { withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      await uploadToR2(r2Key, buf);
      newCovers.push(r2Key);
      console.log(`   ✅ Upload ${r2Key} (${width}px)`);
    }

    // Update meta.json
    meta.covers         = newCovers;
    meta.mangadex_cover = coverFileName;
    meta.cover_widths   = SIZE_SIGNATURE;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
    console.log(`   💾 meta.json diperbarui`);
    updated++;
  }

  console.log(`\n📦 Selesai — ${updated} diperbarui, ${skipped} di-skip`);
}

syncCovers().catch(err => {
  console.error('❌ Cover sync gagal:', err);
  process.exit(1);
});
