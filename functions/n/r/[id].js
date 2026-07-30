// Cloudflare Pages Function — proxy SAME-ORIGIN untuk pencatatan view
// chapter/detail gratis (dipanggil dari src/lib/viewGate.js).
//
// PENTING — path SENGAJA di luar namespace /api/: zona ini punya Custom Rules
// WAF (Security -> WAF -> Custom rules) yang melindungi /api/* secara path-based
// (mis. "Challenge bot user-..." yang mengecualikan /api/webhook/trakteer secara
// eksplisit, ~38rb events — jelas dibuat untuk api.nuranantoscans.my.id tapi
// path-based sehingga ikut menyasar path apa pun berawalan /api/ di domain MANA
// PUN di zona ini) + "Geo gate ID/MY/SG" (Interactive Challenge — MUSTAHIL
// diselesaikan oleh fetch() background, jadi kalau kena, request pasti gagal
// apa pun isinya). Dibuktikan langsung: POST ke nuranantoscans.my.id/api/r/<id>
// dari browser pengunjung asli kena 403 "Sorry, you have been blocked" persis
// halaman block WAF Cloudflare. Path /n/r/ ini menghindari SELURUH proteksi
// yang menyasar /api/* tanpa perlu mengubah/melemahkan rule yang sudah ada.
//
// Catatan deploy: project ini pakai Direct Upload (wrangler pages deploy lewat
// .github/workflows/deploy-pages.yml), bukan Git-integration bawaan Cloudflare.
// Env var yang ditambah/diubah di dashboard Pages baru terikat ke Function pada
// DEPLOYMENT BERIKUTNYA — menambah var saja tidak menyuntik ke deployment yang
// sudah berjalan. Habis ubah env var, picu deploy baru (push apa pun yang tidak
// menyentuh manga/**/.github/**, atau jalankan workflow "Deploy Pages" manual).
//
// Kenapa proxy same-origin ini perlu (terpisah dari masalah WAF di atas):
// dibuktikan lewat DevTools bahwa beberapa ekstensi privasi mem-patch
// window.fetch() di browser dan MENJATUHKAN request SEBELUM sampai jaringan
// sama sekali — tidak muncul di Network tab, tidak error — begitu polanya
// terlihat seperti "beacon pihak ketiga": POST cross-origin (subdomain api.
// berbeda dari halaman) + header custom (X-Device-Id) segera setelah page
// load. Domain api.nuranantoscans.my.id sendiri BERSIH dari EasyList/
// EasyPrivacy dan first-party menurut Public Suffix List (my.id terdaftar di
// PSL) — jadi ini heuristik pola perilaku, bukan reputasi domain, dan pindah
// ke path same-origin ini menghilangkan sinyal "cross-origin" pemicunya.
//
// deploy: folder ini bagian dari repo utama (Cloudflare Pages), auto-deploy
// lewat GitHub — BEDA dari worker/api-worker.js yang di-deploy manual via
// dashboard. Wajib set env var VIEW_PROXY_SECRET di project Pages ini (Settings
// -> Environment variables) dengan nilai SAMA PERSIS dengan VIEW_PROXY_SECRET
// di worker; tanpa itu proxy menjawab 503 dan view tidak tercatat lewat jalur
// ini (endpoint asli /api/r/ di worker tetap berfungsi seperti biasa).
export async function onRequestPost(context) {
  const { request, params, env } = context;
  const id = params.id;
  if (typeof id !== 'string' || !id || id.length > 200) {
    return new Response(JSON.stringify({ error: 'Invalid' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const secret = env.VIEW_PROXY_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Proxy not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const workerBase = env.VIEW_WORKER_URL || 'https://api.nuranantoscans.my.id';
  const upstreamUrl = `${workerBase}/api/r/${encodeURIComponent(id)}`;

  // Teruskan identitas pengunjung SESUNGGUHNYA secara eksplisit. Hop
  // proxy->worker ini adalah koneksi server-to-server milik Cloudflare sendiri;
  // tanpa header X-Real-* ini, worker hanya melihat IP edge Pages Function,
  // bukan pengunjung asli — dedup & rate-limit per-IP jadi rusak untuk SEMUA
  // pengunjung (tercampur jadi satu "IP" yang sama). Worker hanya mempercayai
  // header ini kalau X-Proxy-Secret cocok (lihat worker/api-worker.js).
  //
  // PENTING: User-Agent WAJIB diisi, tidak boleh dikosongkan. Zona ini punya
  // WAF Custom Rule "Challenge bot user-agents" dengan kondisi
  // `http.user_agent eq ""` -> Block, path-agnostic dan berlaku ke SELURUH
  // hostname di zona (termasuk api.nuranantoscans.my.id tujuan hop ini). Tanpa
  // header ini, fetch() dari Pages Function berjalan dengan UA kosong dan
  // diblokir WAF SEBELUM sampai ke worker — persis penyebab 403 yang sempat
  // terlihat seolah dari path/geo-gate, padahal terjadi di hop internal ini,
  // tak terlihat dari DevTools browser sama sekali.
  const upstream = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'X-Device-Id':    request.headers.get('X-Device-Id') || '',
      'X-Proxy-Secret': secret,
      'X-Real-IP':      request.headers.get('CF-Connecting-IP') || '',
      'X-Real-Country': request.headers.get('CF-IPCountry') || '',
      'X-Real-UA':      request.headers.get('User-Agent') || '',
      'User-Agent':     'NurantoScans-ViewProxy/1.0 (+https://nuranantoscans.my.id)',
    },
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
