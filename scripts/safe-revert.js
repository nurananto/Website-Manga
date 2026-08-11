#!/usr/bin/env node
// Rollback kode situs TANPA ikut menghapus data manga (chapter/cover/rating)
// yang mungkin ditambahkan lewat commit lain setelah commit yang di-revert.
//
// Kenapa perlu script ini (bukan git revert biasa):
//   `git revert <sha>` aman kalau commit itu MURNI kode. Tapi kalau commit
//   yang mau dibatalkan ternyata ikut menyentuh manga/** atau
//   public/manga/** (mis. commit campur kode+data), revert polos akan ikut
//   membatalkan bagian data itu juga — chapter yang tercatat di sana
//   "hilang" dari katalog (gambarnya di R2 tetap aman, cuma listing-nya
//   hilang) sampai di-maju-in lagi. Script ini revert commitnya dulu,
//   lalu SENGAJA mengembalikan versi manga/**+public/manga/** persis
//   seperti sebelum revert, jadi cuma bagian kode yang benar-benar batal.
//
// PENTING: ini TIDAK melindungi kasus git reset --hard / force-push ke
// commit lama — itu tetap harus dihindari sama sekali (rewrite history,
// bisa buang commit manga apa pun setelah titik itu). Pakai script ini
// (atau `git revert` biasa untuk commit kode-murni) sebagai gantinya.
//
// Usage:
//   node scripts/safe-revert.js <commit-sha>              # dry-run (default)
//   node scripts/safe-revert.js <commit-sha> --apply       # eksekusi beneran

import { execFileSync } from 'node:child_process';

const sha = process.argv[2];
const apply = process.argv.includes('--apply');

if (!sha) {
  console.error('Usage: node scripts/safe-revert.js <commit-sha> [--apply]');
  process.exit(1);
}

const git = (args) => execFileSync('git', args, { encoding: 'utf-8' }).trim();

function main() {
  // Pastikan working tree bersih SEBELUM benar-benar eksekusi — revert di
  // tengah perubahan belum commit gampang bikin bingung mana hasil revert
  // mana kerjaan sendiri. Dry-run tidak mengubah apa pun, jadi boleh jalan
  // walau tree lagi kotor.
  if (apply) {
    const dirty = git(['status', '--porcelain']);
    if (dirty) {
      console.error('❌ Working tree belum bersih. Commit/stash dulu sebelum revert.');
      process.exit(1);
    }
  }

  const subject = git(['log', '-1', '--format=%s', sha]);
  const touched = git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha])
    .split('\n').filter(Boolean);
  const dataPaths = touched.filter(
    (p) => p.startsWith('manga/') || p.startsWith('public/manga/')
  );
  const codePaths = touched.filter((p) => !dataPaths.includes(p));

  console.log(`📝 Commit target : ${sha}  "${subject}"`);
  console.log(`   Kode (akan dibatalkan)   : ${codePaths.length} file`);
  codePaths.forEach((p) => console.log(`     - ${p}`));
  console.log(`   Data manga (akan DIJAGA) : ${dataPaths.length} file`);
  dataPaths.forEach((p) => console.log(`     - ${p}`));

  if (!apply) {
    console.log('\n🔎 Dry-run saja — tidak ada perubahan dibuat. Tambah --apply untuk eksekusi.');
    return;
  }

  console.log('\n▶️  git revert --no-commit ' + sha);
  git(['revert', '--no-commit', '--no-edit', sha]);

  if (dataPaths.length) {
    console.log(`▶️  Kembalikan ${dataPaths.length} file data manga ke versi sebelum revert...`);
    git(['checkout', `${sha}~1`, '--', ...dataPaths]);
    // Kalau path itu baru DIBUAT oleh commit yang di-revert (bukan diubah),
    // ${sha}~1 tidak punya file itu — checkout di atas akan gagal utk file
    // itu. Fallback: ambil isinya persis dari sha itu sendiri (state SETELAH
    // commit), yang sama saja karena revert belum menyentuhnya di index.
    try {
      git(['checkout', sha, '--', ...dataPaths]);
    } catch { /* sebagian path mungkin memang tidak ada di sha juga — abaikan */ }
  }

  git(['add', '-A']);
  const msg = `revert: batalkan kode dari ${sha.slice(0, 7)} "${subject}" (data manga dipertahankan)`;
  git(['commit', '-m', msg]);
  console.log(`\n✅ Selesai — commit revert dibuat. Cek dengan: git show --stat HEAD`);
  console.log('   Belum di-push. Cek dulu hasilnya, baru `git push` kalau sudah yakin.');
}

main();
