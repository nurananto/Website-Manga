// ============================================================
// MangaFlow — Image Worker
// Deploy sebagai Worker TERPISAH dari API worker.
// Bindings di Dashboard:
//   R2  → nama: R2          → bucket: manga-media
//   D1  → nama: DB          → database: manga-db
//   Var → ALLOWED_ORIGINS   → "nuranantoscans.my.id,nuranantoweb.pages.dev"
//   Var → TOKEN_SECRET      → sama dengan yang di api-worker
// Route: images.nuranantoscans.my.id/*
// ============================================================

// ── Referer check — strict ────────────────────────────────────
// Tidak ada Referer = akses langsung dari browser = tolak
function isAllowedReferer(request, env) {
  const referer = request.headers.get('Referer') || request.headers.get('Origin') || '';
  if (!referer) return false;
  if (referer.includes('localhost') || referer.includes('127.0.0.1')) return true;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.length) return false;
  return allowed.some(d => referer.includes(d));
}

// ── Path safety ───────────────────────────────────────────────
function isSafePath(p) {
  return !p.includes('..') && !p.includes('//') && !/[<>:"|?*\x00-\x1f]/.test(p);
}

// ── Rate limit (images: 60/menit) ────────────────────────────
async function checkRateLimit(request, env) {
  const ip     = request.headers.get('CF-Connecting-IP') || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const key    = `${ip}:img:${minute}`;
  try {
    const row = await env.DB.prepare(
      'INSERT INTO rate_limits (key, count, minute) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count'
    ).bind(key, minute).first();
    const count = row?.count || 1;
    if (count > 60) return false;
    if (Math.random() < 0.02)
      env.DB.prepare('DELETE FROM rate_limits WHERE minute < ?').bind(minute - 5).run();
    return true;
  } catch { return true; }
}

// ── HMAC helpers ──────────────────────────────────────────────
async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAccessToken(token, chapterId, requestIp, env) {
  try {
    const decoded = decodeURIComponent(escape(atob(token + '=='.slice(0, (4 - token.length % 4) % 4))));
    const parts   = decoded.split('|');
    if (parts.length !== 5) return false;
    const [tid, , tokenIp, expiryStr, sig] = parts;
    const payload = `${tid}|${parts[1]}|${tokenIp}|${expiryStr}`;
    if (tid !== chapterId)                                     return false;
    if (tokenIp !== requestIp)                                 return false;
    if (parseInt(expiryStr) < Math.floor(Date.now() / 1000))  return false;
    const expected = await hmacSha256(env.TOKEN_SECRET || '', payload);
    return sig === expected;
  } catch { return false; }
}

// ── Serve helpers ─────────────────────────────────────────────
async function servePublic(request, env, ctx, r2Key) {
  const cache    = caches.default;
  const cacheKey = new Request(`https://cache.internal/${r2Key}`);
  const cached   = await cache.match(cacheKey);
  if (cached) return cached;

  const object = await env.R2.get(r2Key);
  if (!object) return new Response('Not Found', { status: 404 });

  const response = new Response(object.body, {
    headers: {
      'Content-Type':  object.httpMetadata?.contentType || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag':          object.etag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function servePrivate(request, env, r2Key) {
  const object = await env.R2.get(r2Key);
  if (!object) return new Response('Not Found', { status: 404 });
  return new Response(object.body, {
    headers: {
      'Content-Type':  object.httpMetadata?.contentType || 'image/webp',
      'Cache-Control': 'private, no-store',
      'ETag':          object.etag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// ── Main handler ──────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // Strict referer check — akses langsung dari browser ditolak
    if (!isAllowedReferer(request, env))
      return new Response('Not Found', { status: 404 });

    // Rate limit
    if (!(await checkRateLimit(request, env)))
      return new Response('Too Many Requests', { status: 429 });

    const url    = new URL(request.url);
    const r2Key  = url.pathname.replace(/^\//, ''); // strip leading slash
    if (!r2Key || !isSafePath(r2Key))
      return new Response('Not Found', { status: 404 });

    // Path: manga/:mangaId/:segment/:file
    const parts   = r2Key.split('/');
    const segment = parts[2]; // chapter number or 'covers'
    const isChapter = segment && !isNaN(parseFloat(segment));

    if (isChapter) {
      const mangaId   = parts[1];
      const chapterNum = parts[2];
      const chapterId  = `${mangaId}-ch-${chapterNum}`;

      const lockRow = await env.DB.prepare(
        'SELECT unlock_at FROM chapter_locks WHERE chapter_id = ?'
      ).bind(chapterId).first();

      const isLocked = lockRow && new Date(lockRow.unlock_at).getTime() > Date.now();

      if (!isLocked) return servePublic(request, env, ctx, r2Key);

      const accessToken = url.searchParams.get('access');
      if (!accessToken) return new Response('Not Found', { status: 404 });

      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!(await verifyAccessToken(accessToken, chapterId, ip, env)))
        return new Response('Not Found', { status: 404 });

      return servePrivate(request, env, r2Key);
    }

    // Cover / asset lain → publik
    return servePublic(request, env, ctx, r2Key);
  },
};
