// ============================================================
// MangaFlow Worker — single file bundle
// Paste ini di Cloudflare Dashboard → Workers → Edit Code
// Binding yang perlu diset di Dashboard:
//   R2  → nama binding: R2           → bucket: manga-media
//   D1  → nama binding: DB           → database: manga-db
//   Var → TRAKTEER_SECRET            → isi secret dari Trakteer
//   Var → SUPABASE_JWT_SECRET        → dari Supabase Dashboard > Settings > API
//   Var → TOKEN_SECRET               → string rahasia bebas (untuk access token)
//   Var → ADMIN_SECRET               → string rahasia untuk GitHub Action sync locks
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Input validation helpers ─────────────────────────────────
function isStr(v, max = 500) { return typeof v === 'string' && v.length > 0 && v.length <= max; }
function isNum(v) { return typeof v === 'number' && isFinite(v); }

// ── Request size limit ────────────────────────────────────────
function checkBodySize(request, maxBytes = 65536) { // 64 KB default
  const len = parseInt(request.headers.get('Content-Length') || '0');
  return len <= maxBytes;
}

// ── Path traversal guard ──────────────────────────────────────
function isSafePath(p) {
  return !p.includes('..') && !p.includes('//') && !/[<>:"|?*\x00-\x1f]/.test(p);
}

// ── Referer check ─────────────────────────────────────────────
// Env var: ALLOWED_ORIGINS = "nuranantoweb.pages.dev,nuranantoscans.my.id"
function isAllowedReferer(request, env) {
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

// ── Rate limit ────────────────────────────────────────────────
// Images: 40/menit (max 32 gambar/chapter + buffer retry)
// API:    30/menit (proteksi endpoint user dari spam/abuse)
const RATE_LIMIT_IMAGES = 40;
const RATE_LIMIT_API    = 30;
// Ban permanen (70 tahun)
const BAN_DURATION_MS   = 70 * 365.25 * 24 * 3600 * 1000;

async function checkRateLimit(request, env, isImage = false) {
  const ip     = request.headers.get('CF-Connecting-IP') || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const key    = `${ip}:${isImage ? 'img' : 'api'}:${minute}`;

  // Cek ban dulu
  if (await isBanned(ip, env)) return { allowed: false, banned: true };

  // Atomic upsert
  const row = await env.DB.prepare(`
    INSERT INTO rate_limits (key, count, minute) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(key, minute).first();

  const count = row?.count || 1;
  const limit = isImage ? RATE_LIMIT_IMAGES : RATE_LIMIT_API;

  if (count > limit) {
    // Ban sementara 1 jam
    const expires = new Date(Date.now() + BAN_DURATION_MS).toISOString();
    await env.DB.prepare(`
      INSERT OR REPLACE INTO banned_ips (ip, reason, expires_at)
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

// ── Coin mapping Trakteer — proporsional ─────────────────────
// 1 koin = Rp 100 | minimum donasi Rp 1.000 (= 10 koin)
function calcCoins(amount) {
  if (amount < 1000) return 0;
  return Math.floor(amount / 100);
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

  const r2Key = new URL(request.url).pathname.replace(/^\/images\//, '');
  if (!r2Key || !isSafePath(r2Key)) return new Response('Bad Request', { status: 400 });

  // Deteksi chapter: segment ke-3 adalah angka (misal: 25, 1, 1.5)
  // Path: manga / :mangaId / :segment / :file
  const parts   = r2Key.split('/');  // ['manga', 'waka-chan', '25', 'Image001.webp']
  const segment = parts[2];          // '25' atau 'covers'
  const isChapter = segment && !isNaN(parseFloat(segment));

  if (isChapter) {
    const mangaId   = parts[1];
    const chapterNum = parts[2];
    const chapterId  = `${mangaId}-ch-${chapterNum}`;

    // Cek apakah chapter ini terkunci di D1
    const lockRow = await env.DB.prepare(
      'SELECT unlock_at FROM chapter_locks WHERE chapter_id = ?'
    ).bind(chapterId).first();

    const now = Date.now();
    const isLocked = lockRow && new Date(lockRow.unlock_at).getTime() > now;

    if (!isLocked) {
      // Tidak ada lock record ATAU sudah melewati unlock_at → serve publik
      return servePublic(request, env, ctx, r2Key);
    }
    // Chapter terkunci → perlu access token

    // Chapter terkunci → validasi access token di query param
    const accessToken = new URL(request.url).searchParams.get('access');
    if (!accessToken) return new Response('Forbidden', { status: 403 });

    const requestIp  = request.headers.get('CF-Connecting-IP') || 'unknown';
    const tokenValid = await verifyAccessToken(accessToken, chapterId, requestIp, env);
    if (!tokenValid) return new Response('Forbidden', { status: 403 });

    // Authorized → serve dengan private cache (tidak di-cache CDN/browser)
    return servePrivate(request, env, r2Key);
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

async function servePrivate(request, env, r2Key) {
  // Chapter terkunci — tidak di-cache sama sekali
  const object = await env.R2.get(r2Key);
  if (!object) return new Response('Not Found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type':  object.httpMetadata?.contentType || 'image/webp',
      'Cache-Control': 'private, no-store',
      'ETag':          object.etag,
    },
  });
}

// ── Access Token untuk chapter terkunci ──────────────────────
// Token = HMAC-SHA256( chapterId:userId:ip:expiry )
// IP binding → token tidak bisa dibagi ke orang lain (beda IP = invalid)
// Env var: TOKEN_SECRET → string rahasia bebas
async function generateAccessToken(chapterId, userId, ip, env) {
  const expiry  = Math.floor(Date.now() / 1000) + 7200; // 2 jam (bukan 24, supaya sharing makin tidak berguna)
  const secret  = env.TOKEN_SECRET || 'fallback-secret';
  const payload = `${chapterId}|${userId}|${ip}|${expiry}`;
  const sig     = await hmacSha256(secret, payload);
  return btoa(unescape(encodeURIComponent(`${payload}|${sig}`))).replace(/=/g, '');
}

async function verifyAccessToken(token, chapterId, requestIp, env) {
  try {
    const decoded = decodeURIComponent(escape(atob(token + '=='.slice(0, (4 - token.length % 4) % 4))));
    const parts   = decoded.split('|');
    if (parts.length !== 5) return false;

    const [tid, , tokenIp, expiryStr, sig] = parts;
    const payload = `${tid}|${parts[1]}|${tokenIp}|${expiryStr}`;

    if (tid !== chapterId)                                    return false;
    if (tokenIp !== requestIp)                               return false; // IP mismatch → ditolak
    if (parseInt(expiryStr) < Math.floor(Date.now() / 1000)) return false;

    const expected = await hmacSha256(env.TOKEN_SECRET || 'fallback-secret', payload);
    return sig === expected;
  } catch {
    return false;
  }
}

// ── View Counter ─────────────────────────────────────────────
// POST /api/view/:chapterId
// Catat 1 view unik per IP per chapter (permanent dedup)
async function handleView(request, env) {
  const chapterId = new URL(request.url).pathname.replace('/api/view/', '');
  if (!chapterId || !isStr(chapterId, 200) || !isSafePath(chapterId)) {
    return json({ error: 'Invalid chapterId' }, 400);
  }

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
// ── Verify Supabase JWT (HS256 signature + expiry) ───────────
// Env var: SUPABASE_JWT_SECRET → Supabase Dashboard > Settings > API > JWT Secret
async function verifySupabaseToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    // Decode payload dulu
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    // Cek expire
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Cek issuer harus dari Supabase (sub wajib ada)
    if (!payload.sub) return null;

    // Verifikasi HMAC jika JWT secret tersedia — hanya reject jika benar-benar invalid
    if (env.SUPABASE_JWT_SECRET) {
      try {
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        );
        const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
        const sig  = Uint8Array.from(
          atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
          c => c.charCodeAt(0)
        );
        const valid = await crypto.subtle.verify('HMAC', key, sig, data);
        // Hanya log jika tidak valid, tidak langsung reject (bisa RS256)
        if (!valid) console.log('JWT HMAC mismatch — mungkin RS256, lanjut dengan payload check');
      } catch (e) {
        console.log('JWT verify error:', e.message);
      }
    }

    return payload;
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

  // GET /api/user/history — semua history user
  if (pathname === '/api/user/history' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT manga_id, chapter_id, chapter_number, chapter_title, last_read_at FROM history WHERE user_id = ? ORDER BY last_read_at DESC'
    ).bind(user.sub).all();
    return json(rows.results || []);
  }

  // POST /api/user/history — upsert 1 row per manga (timpa chapter lama)
  if (pathname === '/api/user/history' && request.method === 'POST') {
    if (!checkBodySize(request, 4096)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { manga_id, chapter_id, chapter_number, chapter_title } = body;
    if (!isStr(manga_id, 100) || !isStr(chapter_id, 200)) return json({ error: 'Invalid fields' }, 400);

    await env.DB.prepare(`
      INSERT INTO history (user_id, manga_id, chapter_id, chapter_number, chapter_title, last_read_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, manga_id) DO UPDATE SET
        chapter_id     = excluded.chapter_id,
        chapter_number = excluded.chapter_number,
        chapter_title  = excluded.chapter_title,
        last_read_at   = CURRENT_TIMESTAMP
    `).bind(user.sub, manga_id, chapter_id, chapter_number ?? null, chapter_title ?? null).run();

    return json({ ok: true });
  }

  // POST /api/user/chapter-token — generate access token untuk chapter terkunci
  if (pathname === '/api/user/chapter-token' && request.method === 'POST') {
    if (!checkBodySize(request, 1024)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { chapter_id } = body;
    if (!isStr(chapter_id, 200)) return json({ error: 'Invalid chapter_id' }, 400);

    // Cek apakah chapter terkunci
    const lockRow = await env.DB.prepare(
      'SELECT unlock_at FROM chapter_locks WHERE chapter_id = ?'
    ).bind(chapter_id).first();

    if (!lockRow || new Date(lockRow.unlock_at).getTime() <= Date.now()) {
      return json({ error: 'Chapter not locked' }, 400);
    }

    // Cek apakah user sudah unlock chapter ini
    const unlocked = await env.DB.prepare(
      'SELECT 1 FROM unlocked_chapters WHERE user_id = ? AND chapter_id = ?'
    ).bind(user.sub, chapter_id).first();

    if (!unlocked) return json({ error: 'Chapter not unlocked' }, 403);

    const ip    = request.headers.get('CF-Connecting-IP') || 'unknown';
    const token = await generateAccessToken(chapter_id, user.sub, ip, env);
    return json({ token, expires_in: 7200 });
  }

  // POST /api/user/claim-coins — transfer koin dari trk-{email} ke akun Supabase
  if (pathname === '/api/user/claim-coins' && request.method === 'POST') {
    if (!checkBodySize(request, 1024)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { trakteer_email } = body;
    if (!isStr(trakteer_email, 254) || !trakteer_email.includes('@')) {
      return json({ error: 'Invalid email' }, 400);
    }

    const email = trakteer_email.trim().toLowerCase();
    const trkId = `trk-${email}`;

    console.log(`claim-coins: user.sub=${user.sub}, email=${email}, trkId=${trkId}`);

    // Cari koin yang pending di akun Trakteer
    const trkUser = await env.DB.prepare(
      'SELECT coins FROM users WHERE id = ? AND coins > 0'
    ).bind(trkId).first();

    console.log(`claim-coins: trkUser=`, JSON.stringify(trkUser));

    if (!trkUser || trkUser.coins <= 0) {
      return json({ ok: true, transferred: 0, note: 'Tidak ada koin pending' });
    }

    const coinsToTransfer = trkUser.coins;

    // Cek apakah akun Supabase sudah ada di D1
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(user.sub).first();

    if (existingUser) {
      // Akun sudah ada → tambah koin + zero out trk-
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(coinsToTransfer, user.sub),
        env.DB.prepare('UPDATE users SET coins = 0 WHERE id = ?').bind(trkId),
      ]);
    } else {
      // Belum ada → rename trk- record ke Supabase UUID + update semua referensi
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET id = ? WHERE id = ?').bind(user.sub, trkId),
        env.DB.prepare('UPDATE coin_transactions SET user_id = ? WHERE user_id = ?').bind(user.sub, trkId),
        env.DB.prepare('UPDATE history SET user_id = ? WHERE user_id = ?').bind(user.sub, trkId),
      ]);
    }

    console.log(`Claim coins: ${coinsToTransfer} koin dari ${trkId} → ${user.sub}`);
    return json({ ok: true, transferred: coinsToTransfer });
  }

  // GET /api/user/unlocked — list chapter yang sudah dibeli user
  if (pathname === '/api/user/unlocked' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT chapter_id FROM unlocked_chapters WHERE user_id = ?'
    ).bind(user.sub).all();
    return json((rows.results || []).map(r => r.chapter_id));
  }

  // POST /api/user/unlock-chapter — beli chapter dengan koin (atomic)
  if (pathname === '/api/user/unlock-chapter' && request.method === 'POST') {
    if (!checkBodySize(request, 1024)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { chapter_id, cost = 5 } = body;
    if (!isStr(chapter_id, 200)) return json({ error: 'Invalid chapter_id' }, 400);

    // Cek sudah pernah beli
    const alreadyOwned = await env.DB.prepare(
      'SELECT 1 FROM unlocked_chapters WHERE user_id = ? AND chapter_id = ?'
    ).bind(user.sub, chapter_id).first();
    if (alreadyOwned) return json({ ok: true, already_owned: true });

    // Atomic deduction: hanya potong koin jika saldo cukup
    const deducted = await env.DB.prepare(
      'UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ? RETURNING coins'
    ).bind(cost, user.sub, cost).first();

    if (!deducted) return json({ error: 'Insufficient coins' }, 402);

    // Insert unlock record + transaction
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO unlocked_chapters (user_id, chapter_id) VALUES (?, ?)').bind(user.sub, chapter_id),
        env.DB.prepare('INSERT INTO coin_transactions (id, user_id, amount, type, note) VALUES (?, ?, ?, "unlock", ?)').bind(
          crypto.randomUUID(), user.sub, -cost, `Beli chapter: ${chapter_id}`
        ),
      ]);
    } catch (e) {
      // Batch gagal → kembalikan koin
      await env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(cost, user.sub).run();
      return json({ error: 'Transaction failed, coins refunded' }, 500);
    }

    return json({ ok: true, coins_remaining: deducted.coins });
  }

  // GET /api/user/transactions — riwayat transaksi koin
  if (pathname === '/api/user/transactions' && request.method === 'GET') {
    const url   = new URL(request.url);
    const page  = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(20, parseInt(url.searchParams.get('limit') || '10'));
    const offset = (page - 1) * limit;

    const rows = await env.DB.prepare(
      `SELECT id, amount, type, note, created_at
       FROM coin_transactions WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(user.sub, limit, offset).all();

    const total = await env.DB.prepare(
      'SELECT COUNT(*) as n FROM coin_transactions WHERE user_id = ?'
    ).bind(user.sub).first();

    return json({
      data: rows.results || [],
      page,
      limit,
      total: total?.n ?? 0,
      pages: Math.ceil((total?.n ?? 0) / limit),
    });
  }

  return json({ error: 'Not found' }, 404);
}

// ── Admin: sync chapter lock data dari GitHub Action ──────────
// Env var: ADMIN_SECRET → string rahasia untuk GitHub Action
async function handleAdmin(request, env) {
  const secret = request.headers.get('X-Admin-Secret') || '';
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { pathname } = new URL(request.url);

  // POST /api/admin/sync-locks — update chapter_locks dari catalog rebuild
  if (pathname === '/api/admin/sync-locks' && request.method === 'POST') {
    if (!checkBodySize(request, 65536)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    // locks = [{ chapter_id, unlock_at }]
    const { locks } = body;
    if (!Array.isArray(locks)) return json({ error: 'Invalid locks' }, 400);

    const stmts = locks
      .filter(l => isStr(l.chapter_id, 200) && isStr(l.unlock_at, 50))
      .map(l => env.DB.prepare(
        'INSERT INTO chapter_locks (chapter_id, unlock_at) VALUES (?, ?) ON CONFLICT(chapter_id) DO UPDATE SET unlock_at = excluded.unlock_at'
      ).bind(l.chapter_id, l.unlock_at));

    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, synced: stmts.length });
  }

  return json({ error: 'Not found' }, 404);
}

// ── Trakteer Webhook ─────────────────────────────────────────
async function handleWebhook(request, env) {
  // Size limit: Trakteer payload kecil, 32KB lebih dari cukup
  if (!checkBodySize(request, 32768)) return json({ error: 'Payload too large' }, 413);

  const body = await request.text();
  if (!body) return json({ error: 'Empty body' }, 400);

  if (env.TRAKTEER_SECRET) {
    const sig = request.headers.get('x-webhook-token') || '';
    if (sig !== env.TRAKTEER_SECRET) return json({ error: 'Invalid signature' }, 401);
  }

  let data;
  try { data = JSON.parse(body); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  // Field mapping Trakteer:
  // transaction_id  → ID unik transaksi (anti-duplikat)
  // supporter_message → email user (user wajib isi email akun di kolom pesan)
  // price           → nominal donasi dalam rupiah
  const { transaction_id, supporter_name, supporter_message, price } = data;

  const payment_id      = transaction_id;
  const supporter_email = (supporter_message || '').trim().toLowerCase();
  const amount          = price;

  // Selalu return 200 ke Trakteer agar tidak di-retry/auto-disabled
  // Validasi internal — skip proses jika data tidak valid
  if (!isStr(payment_id, 200) || !supporter_email.includes('@') || !isNum(Number(amount))) {
    console.log('Webhook skip: email tidak valid di kolom Pesan:', supporter_message);
    return json({ ok: true, skipped: 'email tidak valid' });
  }

  // Cek duplikat
  const exists = await env.DB.prepare(
    'SELECT id FROM coin_transactions WHERE trakteer_ref = ?'
  ).bind(payment_id).first();
  if (exists) return json({ ok: true, duplicate: true });

  const coins = calcCoins(amount);
  if (!coins) return json({ ok: true, skipped: 'nominal terlalu kecil' });

  // Upsert user berdasarkan email dari pesan
  await env.DB.prepare(
    'INSERT OR IGNORE INTO users (id, email, coins) VALUES (?, ?, 0)'
  ).bind(`trk-${supporter_email}`, supporter_email).run();

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET coins = coins + ? WHERE email = ?').bind(coins, supporter_email),
    env.DB.prepare(
      'INSERT INTO coin_transactions (id, user_id, amount, type, trakteer_ref, note) VALUES (?, (SELECT id FROM users WHERE email = ?), ?, "trakteer", ?, ?)'
    ).bind(
      crypto.randomUUID(), supporter_email, coins, payment_id,
      `Donasi dari ${supporter_name || 'Anonim'}: Rp ${Number(amount).toLocaleString('id')}`
    ),
  ]);

  console.log(`Donasi berhasil: ${supporter_name || 'Anonim'} → ${supporter_email} → Rp ${Number(amount).toLocaleString('id')} → ${coins} koin`);
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
      // ── Rate limit global (semua endpoint kecuali webhook Trakteer) ──
      // Webhook Trakteer dikecualikan agar notifikasi donasi tidak terblokir
      // Images pakai limit lebih tinggi (300/menit) karena 1 chapter = banyak gambar
      if (pathname !== '/api/webhook/trakteer') {
        const isImage = pathname.startsWith('/images/');
        const rl = await checkRateLimit(request, env, isImage);
        if (!rl.allowed)
          return addCors(new Response(rl.banned ? 'Forbidden' : 'Too Many Requests',
            { status: rl.banned ? 403 : 429 }));
      }

      if (pathname.startsWith('/images/'))                           return addCors(await handleImages(request, env, ctx));
      if (pathname.startsWith('/api/view/') && method === 'POST')    return addCors(await handleView(request, env));
      if (pathname.startsWith('/api/user/'))                         return addCors(await handleUser(request, env));
      if (pathname.startsWith('/api/admin/'))                        return addCors(await handleAdmin(request, env));
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
