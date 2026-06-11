// ============================================================
// MangaFlow — API Worker
// Deploy sebagai Worker TERPISAH dari image worker.
// Bindings di Dashboard:
//   D1  → nama: DB               → database: manga-db
//   Var → JWT_SECRET             → string panjang acak (min 32 char)
//   Var → TOKEN_SECRET           → sama dengan di image-worker
//   Var → ADMIN_SECRET           → untuk GitHub Action sync locks
//   Var → TRAKTEER_SECRET        → dari Trakteer
//   Var → GOOGLE_CLIENT_ID       → dari Google Cloud Console
//   Var → GOOGLE_CLIENT_SECRET   → dari Google Cloud Console
//   Var → REDIRECT_BASE          → "https://nuranantoscans.my.id"
//   Var → ALLOWED_ORIGINS        → "nuranantoscans.my.id,nuranantoweb.pages.dev"
//   Var → GITHUB_TOKEN           → untuk cron push views
//   Var → GITHUB_REPO            → "nurananto/Website-Manga"
// Route: api.nuranantoscans.my.id/*
//
// D1 migration tambahan (jalankan sekali di Dashboard → D1 → Console):
//   ALTER TABLE users ADD COLUMN google_id TEXT;
//   ALTER TABLE users ADD COLUMN name TEXT;
//   ALTER TABLE users ADD COLUMN avatar_url TEXT;
//   ALTER TABLE users ADD COLUMN name_changed_at TEXT;
//   CREATE TABLE IF NOT EXISTS refresh_tokens (
//     token TEXT PRIMARY KEY,
//     user_id TEXT NOT NULL,
//     expires_at TEXT NOT NULL,
//     created_at TEXT DEFAULT CURRENT_TIMESTAMP
//   );
//   CREATE TABLE IF NOT EXISTS oauth_states (
//     state TEXT PRIMARY KEY,
//     redirect_url TEXT,
//     expires_at TEXT NOT NULL
//   );
//   CREATE TABLE IF NOT EXISTS login_codes (
//     code TEXT PRIMARY KEY,
//     user_id TEXT NOT NULL,
//     expires_at TEXT NOT NULL
//   );
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options':        'DENY',
  'Referrer-Policy':        'strict-origin-when-cross-origin',
};

// ── Helpers ───────────────────────────────────────────────────
function isStr(v, max = 500) { return typeof v === 'string' && v.length > 0 && v.length <= max; }
function isNum(v)             { return typeof v === 'number' && isFinite(v); }
function isSafePath(p)        { return !p.includes('..') && !p.includes('//') && !/[<>:"|?*\x00-\x1f]/.test(p); }
function checkBodySize(req, max = 65536) {
  const len = parseInt(req.headers.get('Content-Length') || '0');
  return len <= max;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS },
  });
}

function addCors(res) {
  const r = new Response(res.body, res);
  Object.entries({ ...CORS, ...SECURITY_HEADERS }).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}

// ── HMAC / JWT (HS256) ────────────────────────────────────────
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeB64url(s) {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

async function signJwt(payload, secret) {
  const header  = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body    = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}

async function verifyJwt(token, secret) {
  try {
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      decodeB64url(s),
      new TextEncoder().encode(`${h}.${b}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeB64url(b)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Verify custom JWT from Authorization header ───────────────
async function verifyAuth(request, env) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  return verifyJwt(token, env.JWT_SECRET || '');
}

// ── Rate limit (API: 30/menit) ────────────────────────────────
async function checkRateLimit(request, env) {
  const ip     = request.headers.get('CF-Connecting-IP') || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const key    = `${ip}:api:${minute}`;
  try {
    const row = await env.DB.prepare(
      'INSERT INTO rate_limits (key, count, minute) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count'
    ).bind(key, minute).first();
    if ((row?.count || 1) > 30) return false;
    if (Math.random() < 0.02)
      env.DB.prepare('DELETE FROM rate_limits WHERE minute < ?').bind(minute - 5).run();
    return true;
  } catch { return true; }
}

// ── Referer check (untuk non-auth endpoints) ──────────────────
function isAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return true; // server-to-server tanpa origin = ok
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return !allowed.length || allowed.some(d => origin.includes(d));
}

// ── Chapter access token (untuk locked chapter) ───────────────
async function generateAccessToken(chapterId, userId, ip, env) {
  const expiry  = Math.floor(Date.now() / 1000) + 7200;
  const payload = `${chapterId}|${userId}|${ip}|${expiry}`;
  const sig     = await hmacSha256(env.TOKEN_SECRET || '', payload);
  return btoa(unescape(encodeURIComponent(`${payload}|${sig}`))).replace(/=/g, '');
}

// ── Coin mapping Trakteer ─────────────────────────────────────
function calcCoins(amount) {
  if (amount < 1000) return 0;
  return Math.floor(amount / 100);
}

// ── Google OAuth ──────────────────────────────────────────────
// GET /api/auth/google?redirect=https://...
async function handleGoogleLogin(request, env) {
  const url         = new URL(request.url);
  const redirectUrl = url.searchParams.get('redirect') || (env.REDIRECT_BASE || '');
  const state       = crypto.randomUUID();

  // Simpan state → redirect_url di D1 (expire 10 menit)
  const expiresAt = new Date(Date.now() + 600_000).toISOString();
  await env.DB.prepare(
    'INSERT INTO oauth_states (state, redirect_url, expires_at) VALUES (?, ?, ?)'
  ).bind(state, redirectUrl, expiresAt).run();

  const params = new URLSearchParams({
    client_id:     env.GOOGLE_CLIENT_ID || '',
    redirect_uri:  `${new URL(request.url).origin}/api/auth/google/callback`,
    response_type: 'code',
    scope:         'openid email profile',
    state,
    access_type:   'online',
    prompt:        'select_account',
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/auth?${params}`, 302);
}

// GET /api/auth/google/callback?code=...&state=...
async function handleGoogleCallback(request, env) {
  const url   = new URL(request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const redirectBase = env.REDIRECT_BASE || '';

  if (!code || !state) return Response.redirect(`${redirectBase}/?auth_error=missing_params`, 302);

  // Verifikasi state
  const stateRow = await env.DB.prepare(
    'SELECT redirect_url, expires_at FROM oauth_states WHERE state = ?'
  ).bind(state).first();

  if (!stateRow || new Date(stateRow.expires_at) < new Date()) {
    return Response.redirect(`${redirectBase}/?auth_error=invalid_state`, 302);
  }

  await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();

  const redirectUrl = stateRow.redirect_url || redirectBase;

  // Tukar code untuk Google tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri:  `${url.origin}/api/auth/google/callback`,
      grant_type:    'authorization_code',
    }),
  });

  if (!tokenRes.ok) return Response.redirect(`${redirectBase}/?auth_error=token_exchange`, 302);

  const { access_token: googleToken } = await tokenRes.json();

  // Ambil profil Google
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${googleToken}` },
  });
  if (!profileRes.ok) return Response.redirect(`${redirectBase}/?auth_error=profile`, 302);

  const profile = await profileRes.json();
  const { sub: googleId, email, name, picture: avatar_url } = profile;

  if (!googleId || !email) return Response.redirect(`${redirectBase}/?auth_error=profile_data`, 302);

  // Upsert user di D1 — handle migrasi dari Supabase (email sudah ada dengan id berbeda)
  const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  let userId;
  if (existingUser) {
    // User sudah ada (dari Supabase) — update profile, pertahankan id & coins lama
    userId = existingUser.id;
    await env.DB.prepare(
      'UPDATE users SET google_id = ?, name = ?, avatar_url = ? WHERE id = ?'
    ).bind(googleId, name || '', avatar_url || '', userId).run();
  } else {
    // User baru — insert dengan Google sub sebagai id
    userId = googleId;
    await env.DB.prepare(
      'INSERT INTO users (id, google_id, email, name, avatar_url, coins) VALUES (?, ?, ?, ?, ?, 0)'
    ).bind(googleId, googleId, email, name || '', avatar_url || '').run();
  }

  // Auto-claim koin Trakteer yang pending (jika ada)
  const trkRow = await env.DB.prepare('SELECT coins FROM users WHERE id = ? AND coins > 0').bind(`trk-${email.toLowerCase()}`).first();
  if (trkRow?.coins > 0) {
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(trkRow.coins, userId),
      env.DB.prepare('UPDATE users SET coins = 0 WHERE id = ?').bind(`trk-${email.toLowerCase()}`),
    ]);
  }

  // Buat login code (one-time, 60 detik)
  const loginCode = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO login_codes (code, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(loginCode, userId, new Date(Date.now() + 60_000).toISOString()).run();

  // Redirect ke frontend dengan login code
  const finalUrl = new URL(redirectUrl);
  finalUrl.pathname = '/auth';
  finalUrl.searchParams.set('code', loginCode);
  return Response.redirect(finalUrl.toString(), 302);
}

// POST /api/auth/exchange  { code }
async function handleExchange(request, env) {
  if (!checkBodySize(request, 1024)) return json({ error: 'Payload too large' }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const { code } = body;
  if (!isStr(code, 100)) return json({ error: 'Invalid code' }, 400);

  const row = await env.DB.prepare(
    'SELECT user_id, expires_at FROM login_codes WHERE code = ?'
  ).bind(code).first();

  if (!row || new Date(row.expires_at) < new Date())
    return json({ error: 'Invalid or expired code' }, 401);

  await env.DB.prepare('DELETE FROM login_codes WHERE code = ?').bind(code).run();

  const user = await env.DB.prepare(
    'SELECT id, email, name, avatar_url, coins FROM users WHERE id = ?'
  ).bind(row.user_id).first();

  if (!user) return json({ error: 'User not found' }, 404);

  const now = Math.floor(Date.now() / 1000);
  const accessToken = await signJwt({
    sub:        user.id,
    email:      user.email,
    name:       user.name,
    avatar:     user.avatar_url,
    coins:      user.coins,
    iat:        now,
    exp:        now + 3600, // 1 jam
  }, env.JWT_SECRET || '');

  // Refresh token (30 hari, disimpan di D1)
  const refreshToken = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(refreshToken, user.id, new Date(Date.now() + 30 * 86400_000).toISOString()).run();

  // Cleanup refresh token lama milik user ini (max 5 aktif)
  env.DB.prepare(`
    DELETE FROM refresh_tokens WHERE user_id = ? AND token NOT IN (
      SELECT token FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
    )
  `).bind(user.id, user.id).run();

  return json({ access_token: accessToken, refresh_token: refreshToken, user: {
    id: user.id, email: user.email, name: user.name, avatar: user.avatar_url, coins: user.coins,
  }});
}

// POST /api/auth/refresh  { refresh_token }
async function handleRefresh(request, env) {
  if (!checkBodySize(request, 512)) return json({ error: 'Payload too large' }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const { refresh_token } = body;
  if (!isStr(refresh_token, 100)) return json({ error: 'Invalid token' }, 400);

  const row = await env.DB.prepare(
    'SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?'
  ).bind(refresh_token).first();

  if (!row || new Date(row.expires_at) < new Date())
    return json({ error: 'Invalid or expired refresh token' }, 401);

  const user = await env.DB.prepare(
    'SELECT id, email, name, avatar_url, coins FROM users WHERE id = ?'
  ).bind(row.user_id).first();

  if (!user) return json({ error: 'User not found' }, 404);

  // Rotate refresh token
  const newRefresh = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM refresh_tokens WHERE token = ?').bind(refresh_token),
    env.DB.prepare('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').bind(
      newRefresh, user.id, new Date(Date.now() + 30 * 86400_000).toISOString()
    ),
  ]);

  const now = Math.floor(Date.now() / 1000);
  const accessToken = await signJwt({
    sub: user.id, email: user.email, name: user.name,
    avatar: user.avatar_url, coins: user.coins,
    iat: now, exp: now + 3600,
  }, env.JWT_SECRET || '');

  return json({ access_token: accessToken, refresh_token: newRefresh });
}

// POST /api/auth/logout  { refresh_token }
async function handleLogout(request, env) {
  if (!checkBodySize(request, 512)) return json({ error: 'Payload too large' }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ ok: true }); }
  const { refresh_token } = body;
  if (isStr(refresh_token, 100))
    await env.DB.prepare('DELETE FROM refresh_tokens WHERE token = ?').bind(refresh_token).run();
  return json({ ok: true });
}

// ── User endpoints ────────────────────────────────────────────
async function handleUser(request, env) {
  const user = await verifyAuth(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { pathname } = new URL(request.url);
  const method = request.method;

  if (pathname === '/api/user/me' && method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT id, email, name, avatar_url, coins, name_changed_at FROM users WHERE id = ?'
    ).bind(user.sub).first();
    return json(row || { id: user.sub, email: user.email, name: user.name, coins: 0 });
  }

  if (pathname === '/api/user/profile' && method === 'PATCH') {
    if (!checkBodySize(request, 1024)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { name } = body;
    if (!isStr(name, 50)) return json({ error: 'Nama tidak valid (max 50 karakter)' }, 400);

    const current = await env.DB.prepare('SELECT name_changed_at FROM users WHERE id = ?').bind(user.sub).first();
    if (current?.name_changed_at) {
      const lastChange = new Date(current.name_changed_at);
      const oneYear   = 365 * 24 * 60 * 60 * 1000;
      if (Date.now() - lastChange.getTime() < oneYear) {
        const nextAllowed = new Date(lastChange.getTime() + oneYear).toISOString();
        return json({ error: 'Username hanya bisa diganti setahun sekali', next_allowed_at: nextAllowed }, 429);
      }
    }

    await env.DB.prepare(
      'UPDATE users SET name = ?, name_changed_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(name.trim(), user.sub).run();
    return json({ ok: true, name: name.trim() });
  }

  if (pathname === '/api/user/history' && method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT manga_id, chapter_id, chapter_number, chapter_title, last_read_at FROM history WHERE user_id = ? ORDER BY last_read_at DESC'
    ).bind(user.sub).all();
    return json(rows.results || []);
  }

  if (pathname === '/api/user/history' && method === 'POST') {
    if (!checkBodySize(request, 4096)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { manga_id, chapter_id, chapter_number, chapter_title } = body;
    if (!isStr(manga_id, 100) || !isStr(chapter_id, 200)) return json({ error: 'Invalid fields' }, 400);
    await env.DB.prepare(`
      INSERT INTO history (user_id, manga_id, chapter_id, chapter_number, chapter_title, last_read_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, manga_id) DO UPDATE SET
        chapter_id = excluded.chapter_id, chapter_number = excluded.chapter_number,
        chapter_title = excluded.chapter_title, last_read_at = CURRENT_TIMESTAMP
    `).bind(user.sub, manga_id, chapter_id, chapter_number ?? null, chapter_title ?? null).run();
    return json({ ok: true });
  }

  if (pathname === '/api/user/chapter-token' && method === 'POST') {
    if (!checkBodySize(request, 1024)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { chapter_id } = body;
    if (!isStr(chapter_id, 200)) return json({ error: 'Invalid chapter_id' }, 400);
    const lockRow = await env.DB.prepare('SELECT unlock_at FROM chapter_locks WHERE chapter_id = ?').bind(chapter_id).first();
    if (!lockRow || new Date(lockRow.unlock_at).getTime() <= Date.now()) return json({ error: 'Chapter not locked' }, 400);
    const unlocked = await env.DB.prepare('SELECT 1 FROM unlocked_chapters WHERE user_id = ? AND chapter_id = ?').bind(user.sub, chapter_id).first();
    if (!unlocked) return json({ error: 'Chapter not unlocked' }, 403);
    const ip    = request.headers.get('CF-Connecting-IP') || 'unknown';
    const token = await generateAccessToken(chapter_id, user.sub, ip, env);
    return json({ token, expires_in: 7200 });
  }

  if (pathname === '/api/user/claim-coins' && method === 'POST') {
    if (!checkBodySize(request, 1024)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { trakteer_email } = body;
    if (!isStr(trakteer_email, 254) || !trakteer_email.includes('@'))
      return json({ error: 'Invalid email' }, 400);
    const email = trakteer_email.trim().toLowerCase();
    const trkId = `trk-${email}`;
    const trkUser = await env.DB.prepare('SELECT coins FROM users WHERE id = ? AND coins > 0').bind(trkId).first();
    if (!trkUser || trkUser.coins <= 0)
      return json({ ok: true, transferred: 0 });
    const coinsToTransfer = trkUser.coins;
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(coinsToTransfer, user.sub),
      env.DB.prepare('UPDATE users SET coins = 0 WHERE id = ?').bind(trkId),
    ]);
    return json({ ok: true, transferred: coinsToTransfer });
  }

  if (pathname === '/api/user/unlocked' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT chapter_id FROM unlocked_chapters WHERE user_id = ?').bind(user.sub).all();
    return json((rows.results || []).map(r => r.chapter_id));
  }

  if (pathname === '/api/user/unlock-chapter' && method === 'POST') {
    if (!checkBodySize(request, 1024)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { chapter_id, cost = 5 } = body;
    if (!isStr(chapter_id, 200)) return json({ error: 'Invalid chapter_id' }, 400);
    const alreadyOwned = await env.DB.prepare('SELECT 1 FROM unlocked_chapters WHERE user_id = ? AND chapter_id = ?').bind(user.sub, chapter_id).first();
    if (alreadyOwned) return json({ ok: true, already_owned: true });
    const deducted = await env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ? RETURNING coins').bind(cost, user.sub, cost).first();
    if (!deducted) return json({ error: 'Insufficient coins' }, 402);
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO unlocked_chapters (user_id, chapter_id) VALUES (?, ?)').bind(user.sub, chapter_id),
        env.DB.prepare('INSERT INTO coin_transactions (id, user_id, amount, type, note) VALUES (?, ?, ?, "unlock", ?)').bind(
          crypto.randomUUID(), user.sub, -cost, `Beli chapter: ${chapter_id}`
        ),
      ]);
    } catch {
      await env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(cost, user.sub).run();
      return json({ error: 'Transaction failed, coins refunded' }, 500);
    }
    return json({ ok: true, coins_remaining: deducted.coins });
  }

  if (pathname === '/api/user/transactions' && method === 'GET') {
    const u     = new URL(request.url);
    const page  = Math.max(1, parseInt(u.searchParams.get('page') || '1'));
    const limit = Math.min(20, parseInt(u.searchParams.get('limit') || '10'));
    const rows  = await env.DB.prepare(
      'SELECT id, amount, type, note, created_at FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(user.sub, limit, (page - 1) * limit).all();
    const total = await env.DB.prepare('SELECT COUNT(*) as n FROM coin_transactions WHERE user_id = ?').bind(user.sub).first();
    return json({ data: rows.results || [], page, limit, total: total?.n ?? 0, pages: Math.ceil((total?.n ?? 0) / limit) });
  }

  // GET /api/user/notifications
  if (pathname === '/api/user/notifications' && method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id, type, actor_name, manga_id, manga_title, chapter_num, comment_id, preview, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(user.sub).all();
    return json(rows.results || []);
  }

  // POST /api/user/notifications/read-all
  if (pathname === '/api/user/notifications/read-all' && method === 'POST') {
    await env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(user.sub).run();
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
}

// ── Admin endpoints ───────────────────────────────────────────
async function handleAdmin(request, env) {
  const secret = request.headers.get('X-Admin-Secret') || '';
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) return json({ error: 'Unauthorized' }, 401);
  const { pathname } = new URL(request.url);
  if (pathname === '/api/admin/sync-locks' && request.method === 'POST') {
    if (!checkBodySize(request, 65536)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { locks } = body;
    if (!Array.isArray(locks)) return json({ error: 'Invalid locks' }, 400);
    const stmts = locks.filter(l => isStr(l.chapter_id, 200) && isStr(l.unlock_at, 50)).map(l =>
      env.DB.prepare('INSERT INTO chapter_locks (chapter_id, unlock_at) VALUES (?, ?) ON CONFLICT(chapter_id) DO UPDATE SET unlock_at = excluded.unlock_at').bind(l.chapter_id, l.unlock_at)
    );
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, synced: stmts.length });
  }
  return json({ error: 'Not found' }, 404);
}

// ── Comments ──────────────────────────────────────────────────
async function handleComments(request, env) {
  const { pathname } = new URL(request.url);
  const method = request.method;

  // GET /api/comments?chapter=xxx
  if (pathname === '/api/comments' && method === 'GET') {
    const chapterId = new URL(request.url).searchParams.get('chapter');
    if (!chapterId || !isStr(chapterId, 200)) return json({ comments: [] });

    const rows = await env.DB.prepare(`
      SELECT c.id, c.text, c.deleted, c.parent_id, c.created_at,
             u.id as user_id, u.name as user_name, u.avatar_url as user_avatar
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.chapter_id = ?
      ORDER BY c.created_at ASC
      LIMIT 200
    `).bind(chapterId).all();

    const flat = (rows.results || []).map(r => ({
      id:         r.id,
      text:       r.deleted ? '[dihapus]' : r.text,
      deleted:    !!r.deleted,
      parent_id:  r.parent_id,
      created_at: r.created_at,
      user: { id: r.user_id, name: r.user_name || 'User', avatar: r.user_avatar || null },
    }));

    // Susun jadi tree: top-level + replies
    const top = [];
    const byId = {};
    flat.forEach(c => { byId[c.id] = { ...c, replies: [] }; });
    flat.forEach(c => {
      if (c.parent_id && byId[c.parent_id]) byId[c.parent_id].replies.push(byId[c.id]);
      else if (!c.parent_id) top.push(byId[c.id]);
    });

    return json({ comments: top });
  }

  // POST /api/comments  { chapter_id, manga_id, text, parent_id? }
  if (pathname === '/api/comments' && method === 'POST') {
    const user = await verifyAuth(request, env);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!checkBodySize(request, 4096)) return json({ error: 'Payload too large' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { chapter_id, manga_id, text, parent_id } = body;
    if (!isStr(chapter_id, 200) || !isStr(manga_id, 100) || !isStr(text, 2000))
      return json({ error: 'Invalid fields' }, 400);
    if (parent_id && !isStr(parent_id, 100)) return json({ error: 'Invalid parent_id' }, 400);

    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO comments (id, chapter_id, manga_id, user_id, parent_id, text) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, chapter_id, manga_id, user.sub, parent_id || null, text.trim()).run();

    // Notifikasi ke penulis komentar parent (jika reply) — termasuk reply ke diri sendiri
    if (parent_id) {
      const parent = await env.DB.prepare('SELECT user_id FROM comments WHERE id = ?').bind(parent_id).first();
      if (parent) {
        const notifId = crypto.randomUUID();
        env.DB.prepare(
          'INSERT INTO notifications (id, user_id, type, actor_name, manga_id, comment_id, preview) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(notifId, parent.user_id, 'reply', user.name || user.email || 'User', manga_id, id, text.trim().slice(0, 100)).run();
      }
    }

    return json({
      id, text: text.trim(), deleted: false, parent_id: parent_id || null, created_at: new Date().toISOString(),
      user: { id: user.sub, name: user.name || user.email || 'User', avatar: user.avatar || null },
      replies: [],
    });
  }

  // DELETE /api/comments/:id
  const deleteMatch = pathname.match(/^\/api\/comments\/([a-f0-9-]{36})$/);
  if (deleteMatch && method === 'DELETE') {
    const user = await verifyAuth(request, env);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const commentId = deleteMatch[1];
    const row = await env.DB.prepare('SELECT user_id, parent_id FROM comments WHERE id = ?').bind(commentId).first();
    if (!row) return json({ error: 'Not found' }, 404);
    if (row.user_id !== user.sub) return json({ error: 'Forbidden' }, 403);

    // Jika ada replies → soft delete, jika tidak → hard delete
    const hasReplies = await env.DB.prepare('SELECT 1 FROM comments WHERE parent_id = ? LIMIT 1').bind(commentId).first();
    if (hasReplies) {
      await env.DB.prepare('UPDATE comments SET deleted = 1 WHERE id = ?').bind(commentId).run();
    } else {
      await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
    }
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
}

// ── View counter ──────────────────────────────────────────────
async function handleView(request, env) {
  const chapterId = new URL(request.url).pathname.replace('/api/view/', '');
  if (!chapterId || !isStr(chapterId, 200) || !isSafePath(chapterId)) return json({ error: 'Invalid' }, 400);
  const ip    = request.headers.get('CF-Connecting-IP') || 'unknown';
  const today = new Date().toISOString().slice(0, 10);
  const raw   = new TextEncoder().encode(`${ip}:${chapterId}:${today}`);
  const buf   = await crypto.subtle.digest('SHA-256', raw);
  const hash  = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT OR IGNORE INTO chapter_views (chapter_id, ip_hash) VALUES (?, ?)').bind(chapterId, hash).run();
  return json({ ok: true });
}

// ── Trakteer webhook ──────────────────────────────────────────
async function handleWebhook(request, env) {
  if (!checkBodySize(request, 32768)) return json({ error: 'Payload too large' }, 413);
  const body = await request.text();
  if (!body) return json({ error: 'Empty body' }, 400);
  if (env.TRAKTEER_SECRET) {
    const sig = request.headers.get('x-webhook-token') || '';
    if (sig !== env.TRAKTEER_SECRET) return json({ error: 'Invalid signature' }, 401);
  }
  let data;
  try { data = JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const { transaction_id, supporter_name, supporter_message, price } = data;
  const payment_id      = transaction_id;
  const supporter_email = (supporter_message || '').trim().toLowerCase();
  const amount          = price;
  if (!isStr(payment_id, 200) || !supporter_email.includes('@') || !isNum(Number(amount))) {
    return json({ ok: true, skipped: 'email tidak valid' });
  }
  const exists = await env.DB.prepare('SELECT id FROM coin_transactions WHERE trakteer_ref = ?').bind(payment_id).first();
  if (exists) return json({ ok: true, duplicate: true });
  const coins = calcCoins(amount);
  if (!coins) return json({ ok: true, skipped: 'nominal terlalu kecil' });
  await env.DB.prepare('INSERT OR IGNORE INTO users (id, email, coins) VALUES (?, ?, 0)').bind(`trk-${supporter_email}`, supporter_email).run();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET coins = coins + ? WHERE email = ?').bind(coins, supporter_email),
    env.DB.prepare('INSERT INTO coin_transactions (id, user_id, amount, type, trakteer_ref, note) VALUES (?, (SELECT id FROM users WHERE email = ?), ?, "trakteer", ?, ?)').bind(
      crypto.randomUUID(), supporter_email, coins, payment_id,
      `Donasi dari ${supporter_name || 'Anonim'}: Rp ${Number(amount).toLocaleString('id')}`
    ),
  ]);
  return json({ ok: true, coins_added: coins });
}

// ── Cron: sync views ke GitHub ────────────────────────────────
async function handleCron(env) {
  try {
    await env.DB.prepare("UPDATE sync_log SET last_attempt = CURRENT_TIMESTAMP, status = 'pending' WHERE id = 1").run();
    const ghHeaders = { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'manga-worker' };
    const rows = await env.DB.prepare('SELECT chapter_id, COUNT(*) as views FROM chapter_views GROUP BY chapter_id').all();
    const byManga = {};
    for (const row of rows.results) {
      const match = row.chapter_id.match(/^(.+)-ch-(.+)$/);
      if (!match) continue;
      const [, mangaId, chNum] = match;
      if (!byManga[mangaId]) byManga[mangaId] = {};
      byManga[mangaId][chNum] = row.views;
    }
    if (Object.keys(byManga).length === 0) {
      await env.DB.prepare("UPDATE sync_log SET last_success = CURRENT_TIMESTAMP, status = 'ok' WHERE id = 1").run();
      return;
    }
    const repoApi = `https://api.github.com/repos/${env.GITHUB_REPO}`;
    const { object: { sha: headSha } } = await (await fetch(`${repoApi}/git/ref/heads/main`, { headers: ghHeaders })).json();
    const { tree: { sha: treeSha } }   = await (await fetch(`${repoApi}/git/commits/${headSha}`, { headers: ghHeaders })).json();
    const treeItems = [];
    for (const [mangaId, chapterViews] of Object.entries(byManga)) {
      const filePath = `manga/${mangaId}/meta.json`;
      const getRes   = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}`, { headers: ghHeaders });
      if (!getRes.ok) continue;
      const { content: encoded } = await getRes.json();
      const meta = JSON.parse(atob(encoded.replace(/\n/g, '')));
      const existing = meta.chapter_views ?? {};
      for (const [chNum, count] of Object.entries(chapterViews)) existing[chNum] = (existing[chNum] ?? 0) + count;
      meta.chapter_views = existing;
      meta.total_views   = Object.values(existing).reduce((s, v) => s + v, 0);
      treeItems.push({ path: filePath, mode: '100644', type: 'blob', content: JSON.stringify(meta, null, 2) + '\n' });
    }
    if (!treeItems.length) throw new Error('no files');
    const { sha: newTreeSha }   = await (await fetch(`${repoApi}/git/trees`, { method: 'POST', headers: ghHeaders, body: JSON.stringify({ base_tree: treeSha, tree: treeItems }) })).json();
    const { sha: newCommitSha } = await (await fetch(`${repoApi}/git/commits`, { method: 'POST', headers: ghHeaders, body: JSON.stringify({ message: `chore: update view counts`, tree: newTreeSha, parents: [headSha] }) })).json();
    const updateRef = await fetch(`${repoApi}/git/refs/heads/main`, { method: 'PATCH', headers: ghHeaders, body: JSON.stringify({ sha: newCommitSha }) });
    if (!updateRef.ok) throw new Error('ref update failed');
    await env.DB.prepare('DELETE FROM chapter_views').run();
    await env.DB.prepare("UPDATE sync_log SET last_success = CURRENT_TIMESTAMP, status = 'ok' WHERE id = 1").run();
  } catch (err) {
    console.error('Cron error:', err);
    await env.DB.prepare("UPDATE sync_log SET status = 'failed' WHERE id = 1").run();
  }
}

// ── Main router ───────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    try {
      // Auth endpoints — tidak kena rate limit (rate limit ada di OAuth provider)
      if (pathname === '/api/auth/google' && method === 'GET')           return handleGoogleLogin(request, env);
      if (pathname === '/api/auth/google/callback' && method === 'GET')  return handleGoogleCallback(request, env);
      if (pathname === '/api/auth/exchange' && method === 'POST')        return addCors(await handleExchange(request, env));
      if (pathname === '/api/auth/refresh'  && method === 'POST')        return addCors(await handleRefresh(request, env));
      if (pathname === '/api/auth/logout'   && method === 'POST')        return addCors(await handleLogout(request, env));

      // Webhook Trakteer — dikecualikan dari rate limit
      if (pathname === '/api/webhook/trakteer' && method === 'POST')     return addCors(await handleWebhook(request, env));

      // Rate limit untuk semua endpoint lainnya
      if (!(await checkRateLimit(request, env)))
        return addCors(new Response('Too Many Requests', { status: 429 }));

      if (pathname.startsWith('/api/view/') && method === 'POST')    return addCors(await handleView(request, env));
      if (pathname.startsWith('/api/comments'))                      return addCors(await handleComments(request, env));
      if (pathname.startsWith('/api/user/'))                         return addCors(await handleUser(request, env));
      if (pathname.startsWith('/api/admin/'))                        return addCors(await handleAdmin(request, env));
      if (pathname === '/')                                           return addCors(json({ status: 'ok', service: 'manga-api' }));

      return addCors(new Response('Not Found', { status: 404 }));
    } catch (err) {
      console.error(err);
      return addCors(new Response('Internal Server Error', { status: 500 }));
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },
};
