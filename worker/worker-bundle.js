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

// ── Referer check ─────────────────────────────────────────────
// Env var: ALLOWED_ORIGINS = "nuranantoweb.pages.dev,nuranantoscans.my.id"
function isAllowedReferer(request, env) {
  // Referer / Origin check
  const referer = request.headers.get('Referer') || request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.length) return true;
  return allowed.some(domain => referer.includes(domain));
}

// ── Ban check ─────────────────────────────────────────────────
async function isBanned(ip, env) {
  const row = await env.DB.prepare(`
    SELECT expires_at FROM banned_ips
    WHERE ip = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
  `).bind(ip).first();
  return !!row;
}

// ── Rate limit: 50 request/menit, langsung ban 70 tahun ──────
const RATE_LIMIT = 50;

async function checkRateLimit(request, env) {
  const ip     = request.headers.get('CF-Connecting-IP') || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const key    = `${ip}:${minute}`;

  // Cek ban dulu
  if (await isBanned(ip, env)) return { allowed: false, banned: true };

  // Atomic upsert
  const row = await env.DB.prepare(`
    INSERT INTO rate_limits (key, count, minute) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(key, minute).first();

  const count = row?.count || 1;

  if (count > RATE_LIMIT) {
    // Langsung ban 70 tahun
    const expires = new Date(Date.now() + 70 * 365.25 * 24 * 3600000).toISOString();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO banned_ips (ip, reason, expires_at)
      VALUES (?, 'Auto-ban: exceeded rate limit', ?)
    `).bind(ip, expires).run();

    return { allowed: false, banned: true };
  }

  // Cleanup sesekali
  if (Math.random() < 0.01) {
    env.DB.prepare('DELETE FROM rate_limits WHERE minute < ?').bind(minute - 5).run();
  }

  return { allowed: true };
}

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
  // Referer check
  if (!isAllowedReferer(request, env))
    return new Response('Forbidden', { status: 403 });

  // Rate limit + ban check
  const rl = await checkRateLimit(request, env);
  if (!rl.allowed)
    return new Response(rl.banned ? 'Forbidden' : 'Too Many Requests',
      { status: rl.banned ? 403 : 429 });

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
      'Cache-Control':             'public, max-age=31536000, immutable',     // 1 tahun, tidak berubah
      'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',  // 1 tahun di edge CF
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

    // Update semua manga meta.json dalam SATU commit menggunakan Tree API
    const repoApi = `https://api.github.com/repos/${env.GITHUB_REPO}`;

    // 1. Ambil HEAD commit SHA
    const refRes = await fetch(`${repoApi}/git/ref/heads/main`, { headers: ghHeaders });
    if (!refRes.ok) { console.error('Failed to get ref'); throw new Error('git ref failed'); }
    const { object: { sha: headSha } } = await refRes.json();

    // 2. Ambil tree SHA dari commit
    const commitRes = await fetch(`${repoApi}/git/commits/${headSha}`, { headers: ghHeaders });
    const { tree: { sha: treeSha } } = await commitRes.json();

    // 3. Siapkan semua perubahan file
    const treeItems = [];
    let successCount = 0;

    for (const [mangaId, chapterViews] of Object.entries(byManga)) {
      const filePath = `manga/${mangaId}/meta.json`;
      const apiUrl   = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}`;

      const getRes = await fetch(apiUrl, { headers: ghHeaders });
      if (!getRes.ok) { console.error(`Skip ${mangaId}: file not found`); continue; }

      const { content: encoded } = await getRes.json();
      const meta = JSON.parse(atob(encoded.replace(/\n/g, '')));

      const existing = meta.chapter_views ?? {};
      for (const [chNum, count] of Object.entries(chapterViews)) {
        existing[chNum] = (existing[chNum] ?? 0) + count;
      }
      meta.chapter_views = existing;
      meta.total_views   = Object.values(existing).reduce((s, v) => s + v, 0);

      treeItems.push({
        path: filePath,
        mode: '100644',
        type: 'blob',
        content: JSON.stringify(meta, null, 2) + '\n',
      });
      successCount++;
    }

    if (treeItems.length === 0) throw new Error('no files to update');

    // 4. Buat tree baru
    const newTreeRes = await fetch(`${repoApi}/git/trees`, {
      method: 'POST', headers: ghHeaders,
      body: JSON.stringify({ base_tree: treeSha, tree: treeItems }),
    });
    const { sha: newTreeSha } = await newTreeRes.json();

    // 5. Buat commit baru
    const newCommitRes = await fetch(`${repoApi}/git/commits`, {
      method: 'POST', headers: ghHeaders,
      body: JSON.stringify({
        message: `chore: update view counts (${Object.keys(byManga).sort().join(', ')})`,
        tree: newTreeSha,
        parents: [headSha],
      }),
    });
    const { sha: newCommitSha } = await newCommitRes.json();

    // 6. Update ref
    const updateRefRes = await fetch(`${repoApi}/git/refs/heads/main`, {
      method: 'PATCH', headers: ghHeaders,
      body: JSON.stringify({ sha: newCommitSha }),
    });

    if (!updateRefRes.ok) {
      console.error('Failed to update ref:', await updateRefRes.text());
      throw new Error('ref update failed');
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
// ── Verify Supabase JWT ───────────────────────────────────────
// Env var: SUPABASE_JWT_SECRET → dari Supabase Dashboard > Settings > API > JWT Secret
async function verifySupabaseToken(request, env) {
  if (!env.SUPABASE_JWT_SECRET) return null;
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;

  try {
    // Decode JWT payload (bagian ke-2, base64url)
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    // Cek expire
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload; // { sub: userId, email, ... }
  } catch {
    return null;
  }
}

async function handleUser(request, env) {
  const user = await verifySupabaseToken(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { pathname } = new URL(request.url);

  // GET /api/user/me — info user + coins
  if (pathname === '/api/user/me' && request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT id, email, coins FROM users WHERE id = ?'
    ).bind(user.sub).first();
    return json(row || { id: user.sub, email: user.email, coins: 0 });
  }

  return json({ error: 'Not found' }, 404);
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
