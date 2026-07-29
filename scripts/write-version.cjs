// Tulis dist/version.json SETELAH build. Dipakai klien (App.jsx) untuk deteksi
// update: reload penuh saat KODE berubah, refresh halus saat hanya KATALOG berubah.
//
// Kunci desain: `v` = hash isi bundle JS/CSS → berubah HANYA kalau kode berubah.
// Karena deploy kode (deploy-pages.yml) & deploy katalog (build-catalog.yml)
// sama-sama `npm run build`, hash untuk kode yang sama identik. Jadi meski deploy
// katalog "menang" belakangan, `v` tetap mencerminkan kode terkini → update kode
// tak pernah lagi ketelan sinkron katalog.
//
// VERSION_TYPE=catalog → tandai deploy ini sebagai sinkron katalog (hint klien).
// Default 'code'. Skrip dibuat defensif: apa pun yang gagal → fallback timestamp,
// tidak boleh menggagalkan build.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = path.resolve(__dirname, '..', 'dist');
const type = process.env.VERSION_TYPE === 'catalog' ? 'catalog' : 'code';

function codeHash() {
  const hash = crypto.createHash('sha256');
  let seen = 0;
  for (const sub of ['entry', 'assets']) {
    const dir = path.join(distDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/\.(js|css)$/.test(f)) continue;
      hash.update(sub + '/' + f);                 // nama (sudah content-hash utk assets)
      hash.update(fs.readFileSync(path.join(dir, f))); // isi (utk entry nama-tetap)
      seen++;
    }
  }
  if (!seen) throw new Error('tidak ada aset JS/CSS di dist');
  return hash.digest('hex').slice(0, 12);
}

let v;
try {
  v = codeHash();
} catch (err) {
  // Fallback aman: jangan sampai build gagal hanya karena versioning.
  console.warn('write-version: fallback timestamp —', err.message);
  v = 'ts' + Math.floor(Date.now() / 1000).toString(36);
}

const version = {
  v,                                       // identitas KODE (reload saat berubah)
  catalog: Math.floor(Date.now() / 1000).toString(), // stempel katalog (refresh halus)
  label: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
  type,
};

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(version));
console.log('version.json →', JSON.stringify(version));
