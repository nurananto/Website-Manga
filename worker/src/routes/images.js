/**
 * Serve gambar dari R2
 *
 * Public  → Cache di Cloudflare edge (30 hari)
 * Locked  → Cek unlock di D1, cache private di browser (1 jam)
 *
 * Path format:
 *   /images/manga/:mangaId/covers/:file
 *   /images/manga/:mangaId/chapters/:chapterNum/:file
 */

export async function handleImages(request, env, ctx) {
  const url  = new URL(request.url);
  // Hapus prefix /images/ → jadi key R2
  const r2Key = url.pathname.replace(/^\/images\//, '');

  if (!r2Key) return new Response('Bad Request', { status: 400 });

  // Tentukan apakah chapter ini publik atau terkunci
  // Path chapter: manga/:mangaId/chapters/:chapterNum/Image001.webp
  const chapterMatch = r2Key.match(/^manga\/([^/]+)\/chapters\/([^/]+)\//);

  if (chapterMatch) {
    const [, mangaId, chapterNum] = chapterMatch;
    return serveChapterImage(request, env, ctx, r2Key, mangaId, chapterNum);
  }

  // Cover / aset lain → selalu publik
  return servePublic(request, env, ctx, r2Key);
}

async function serveChapterImage(request, env, ctx, r2Key, mangaId, chapterNum) {
  // TODO: ambil catalog untuk cek unlock_date
  // Untuk sekarang: semua chapter yang lock_hours > 0 dianggap terkunci
  // sampai auth ditambahkan
  // → Sementara semua bisa diakses (development mode)

  return servePublic(request, env, ctx, r2Key);

  // Nanti setelah auth aktif:
  // if (isLocked) {
  //   const user = await getAuthUser(request, env);
  //   if (!user) return new Response('Unauthorized', { status: 401 });
  //   const unlocked = await env.DB.prepare(
  //     'SELECT 1 FROM unlocked_chapters WHERE user_id = ? AND chapter_id = ?'
  //   ).bind(user.id, `${mangaId}-ch-${chapterNum}`).first();
  //   if (!unlocked) return new Response('Forbidden', { status: 403 });
  //   return servePrivate(request, env, r2Key);
  // }
}

async function servePublic(request, env, ctx, r2Key) {
  // Cek Cloudflare edge cache
  const cache    = caches.default;
  const cacheKey = new Request(`https://cache.internal/${r2Key}`);
  const cached   = await cache.match(cacheKey);
  if (cached) return cached;

  const object = await env.R2.get(r2Key);
  if (!object) return new Response('Not Found', { status: 404 });

  const response = new Response(object.body, {
    headers: {
      'Content-Type':  object.httpMetadata?.contentType || 'image/webp',
      'Cache-Control': 'public, max-age=2592000',   // 30 hari di edge
      'ETag':          object.etag,
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
      'Cache-Control': 'private, max-age=3600',     // hanya browser user
    },
  });
}
