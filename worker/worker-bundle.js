// ============================================================
// MangaFlow Worker — single file bundle
// Paste ini di Cloudflare Dashboard → Workers → Edit Code
// Binding yang perlu diset di Dashboard:
//   R2  → nama binding: R2      → bucket: manga-media
//   D1  → nama binding: DB      → database: manga-db
//   Var → TRAKTEER_SECRET       → isi secret dari Trakteer
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Coin mapping Trakteer ────────────────────────────────────
const COIN_MAP = [
  { min: 50000, coins: 600 },
  { min: 20000, coins: 220 },
  { min: 10000, coins: 100 },
  { min:  5000, coins:  50 },
  { min:     0, coins:  10 },
];

function calcCoins(amount) {
  for (const t of COIN_MAP) if (amount >= t.min) return t.coins;
  return 0;
}

// ── Helpers ──────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function addCors(response) {
  const res = new Response(response.body, response);
  Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── R2 Image Handler ─────────────────────────────────────────
// Path: /images/manga/:mangaId/:chapterNumOrCovers/:file
// Contoh:
//   /images/manga/waka-chan/covers/cover1.webp  → public
//   /images/manga/waka-chan/25/Image001.webp    → chapter (cek lock)
//   /images/manga/waka-chan/1.5/Image001.webp   → chapter (cek lock)

async function handleImages(request, env, ctx) {
  const r2Key = new URL(request.url).pathname.replace(/^\/images\//, '');
  if (!r2Key) return new Response('Bad Request', { status: 400 });

  // Deteksi chapter: segment ke-3 adalah angka (misal: 25, 1, 1.5)
  // Path: manga / :mangaId / :segment / :file
  const parts   = r2Key.split('/');  // ['manga', 'waka-chan', '25', 'Image001.webp']
  const segment = parts[2];          // '25' atau 'covers'
  const isChapter = segment && !isNaN(parseFloat(segment));

  if (isChapter) {
    // Nanti: cek apakah chapter ini terkunci dan user sudah unlock
    // Untuk sekarang semua chapter bisa diakses (belum ada auth)
    return servePublic(request, env, ctx, r2Key);
  }

  // Cover atau aset lain → selalu publik
  return servePublic(request, env, ctx, r2Key);
}

async function servePublic(request, env, ctx, r2Key) {
  const cache    = caches.default;
  const cacheKey = new Request(`https://cache.internal/${r2Key}`);
  const cached   = await cache.match(cacheKey);
  if (cached) return cached;

  const object = await env.R2.get(r2Key);
  if (!object) return new Response('Not Found', { status: 404 });

  const response = new Response(object.body, {
    headers: {
      'Content-Type':              object.httpMetadata?.contentType || 'image/webp',
      'Cache-Control':             'public, max-age=604800, s-maxage=604800', // 7 hari
      'Cloudflare-CDN-Cache-Control': 'public, max-age=604800',               // 7 hari di edge CF
      'ETag':                      object.etag,
    },
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

// ── View Counter ─────────────────────────────────────────────
// POST /api/view/:chapterId
// Catat 1 view unik per IP per chapter (permanent dedup)
async function handleView(request, env) {
  const chapterId = new URL(request.url).pathname.replace('/api/view/', '');
  if (!chapterId) return json({ error: 'Missing chapterId' }, 400);

  // Ambil IP asli dari Cloudflare header
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Hash IP + chapterId + tanggal → besok hash beda, tidak ada data lama menumpuk
  const today = new Date().toISOString().slice(0, 10); // "2026-06-01"
  const raw  = new TextEncoder().encode(`${ip}:${chapterId}:${today}`);
  const buf  = await crypto.subtle.digest('SHA-256', raw);
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

  // INSERT OR IGNORE → skip kalau sudah pernah buka
  await env.DB.prepare(
    'INSERT OR IGNORE INTO chapter_views (chapter_id, ip_hash) VALUES (?, ?)'
  ).bind(chapterId, hash).run();

  return json({ ok: true });
}

// ── Cron: Push views ke GitHub tiap 00:00 WIB (17:00 UTC) ───
async function handleCron(env) {
  try {
    // Update status → sedang proses
    await env.DB.prepare(
      "UPDATE sync_log SET last_attempt = CURRENT_TIMESTAMP, status = 'pending' WHERE id = 1"
    ).run();

    const ghHeaders = {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type':  'application/json',
      'User-Agent':    'manga-worker',
    };

    // Hitung views per chapter dari D1
    // chapter_id format: "waka-chan-ch-25" → mangaId="waka-chan", chNum="25"
    const rows = await env.DB.prepare(
      'SELECT chapter_id, COUNT(*) as views FROM chapter_views GROUP BY chapter_id'
    ).all();

    // Kelompokkan per manga
    const byManga = {};
    for (const row of rows.results) {
      const match = row.chapter_id.match(/^(.+)-ch-(.+)$/);
      if (!match) continue;
      const [, mangaId, chNum] = match;
      if (!byManga[mangaId]) byManga[mangaId] = {};
      byManga[mangaId][chNum] = row.views;
    }

    // Update tiap manga meta.json di GitHub
    let successCount = 0;
    for (const [mangaId, chapterViews] of Object.entries(byManga)) {
      const filePath = `manga/${mangaId}/meta.json`;
      const apiUrl   = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}`;

      // Ambil meta.json saat ini
      const getRes = await fetch(apiUrl, { headers: ghHeaders });
      if (!getRes.ok) { console.error(`Skip ${mangaId}: file not found`); continue; }

      const { sha, content: encoded } = await getRes.json();
      const meta = JSON.parse(atob(encoded.replace(/\n/g, '')));

      // TAMBAHKAN ke total yang sudah ada (bukan replace)
      const existing = meta.chapter_views ?? {};
      for (const [chNum, count] of Object.entries(chapterViews)) {
        existing[chNum] = (existing[chNum] ?? 0) + count;
      }
      meta.chapter_views = existing;
      meta.total_views   = Object.values(existing).reduce((s, v) => s + v, 0);

      const putRes = await fetch(apiUrl, {
        method:  'PUT',
        headers: ghHeaders,
        body:    JSON.stringify({
          message: `chore: update view counts ${mangaId}`,
          content: btoa(JSON.stringify(meta, null, 2)),
          sha,
        }),
      });

      if (putRes.ok) { successCount++; }
      else { console.error(`Failed update ${mangaId}:`, await putRes.text()); }
    }

    // Tidak ada views hari ini → ok, tidak ada yang perlu dipush
    if (Object.keys(byManga).length === 0) {
      await env.DB.prepare(
        "UPDATE sync_log SET last_success = CURRENT_TIMESTAMP, status = 'ok' WHERE id = 1"
      ).run();
      console.log('View sync OK: no views today');
      return;
    }

    // Ada views tapi semua gagal push → failed
    if (successCount === 0) {
      await env.DB.prepare("UPDATE sync_log SET status = 'failed' WHERE id = 1").run();
      return;
    }

    // Hapus semua data D1 setelah berhasil push ke GitHub
    await env.DB.prepare('DELETE FROM chapter_views').run();

    await env.DB.prepare(
      "UPDATE sync_log SET last_success = CURRENT_TIMESTAMP, status = 'ok' WHERE id = 1"
    ).run();

    console.log(`View sync OK: ${successCount}/${Object.keys(byManga).length} manga updated, D1 cleared`);

  } catch (err) {
    console.error('Cron error:', err);
    await env.DB.prepare(
      "UPDATE sync_log SET status = 'failed' WHERE id = 1"
    ).run();
  }
}

// ── User Handler (disabled sampai auth aktif) ────────────────
async function handleUser(request, env) {
  // TODO: aktifkan setelah Supabase auth ditambahkan
  return json({ error: 'Auth belum aktif' }, 401);
}

// ── Trakteer Webhook ─────────────────────────────────────────
async function handleWebhook(request, env) {
  const body = await request.text();

  if (env.TRAKTEER_SECRET) {
    const sig      = request.headers.get('X-Trakteer-Signature') || '';
    const expected = await hmacSha256(env.TRAKTEER_SECRET, body);
    if (sig !== expected) return json({ error: 'Invalid signature' }, 401);
  }

  let data;
  try { data = JSON.parse(body); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { payment_id, supporter_email, supporter_name, amount } = data;
  if (!payment_id || !supporter_email || !amount) return json({ error: 'Missing fields' }, 400);

  // Cek duplikat
  const exists = await env.DB.prepare(
    'SELECT id FROM coin_transactions WHERE trakteer_ref = ?'
  ).bind(payment_id).first();
  if (exists) return json({ ok: true, duplicate: true });

  const coins = calcCoins(amount);
  if (!coins) return json({ ok: true, coins: 0 });

  await env.DB.prepare(
    'INSERT OR IGNORE INTO users (id, email, coins) VALUES (?, ?, 0)'
  ).bind(`trakteer-${supporter_email}`, supporter_email).run();

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET coins = coins + ? WHERE email = ?').bind(coins, supporter_email),
    env.DB.prepare(
      'INSERT INTO coin_transactions (id, user_id, amount, type, trakteer_ref, note) VALUES (?, (SELECT id FROM users WHERE email = ?), ?, "trakteer", ?, ?)'
    ).bind(crypto.randomUUID(), supporter_email, coins, payment_id,
           `Donasi dari ${supporter_name || supporter_email}: Rp ${Number(amount).toLocaleString('id')}`),
  ]);

  return json({ ok: true, coins_added: coins });
}

// ── Main Router ───────────────────────────────────────────────
export default {
  // ── HTTP requests ─────────────────────────────────────────
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    try {
      if (pathname.startsWith('/images/'))                           return addCors(await handleImages(request, env, ctx));
      if (pathname.startsWith('/api/view/') && method === 'POST')    return addCors(await handleView(request, env));
      if (pathname.startsWith('/api/user/'))                         return addCors(await handleUser(request, env));
      if (pathname === '/api/webhook/trakteer' && method === 'POST') return addCors(await handleWebhook(request, env));
      if (pathname === '/')                                           return addCors(json({ status: 'ok', service: 'manga-worker' }));
      return addCors(new Response('Not Found', { status: 404 }));
    } catch (err) {
      console.error(err);
      return addCors(new Response('Internal Server Error', { status: 500 }));
    }
  },

  // ── Cron Trigger: tiap hari 00:00 WIB (17:00 UTC) ─────────
  // Tambahkan di Dashboard → Worker → Triggers → Cron: "0 17 * * *"
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },
};
