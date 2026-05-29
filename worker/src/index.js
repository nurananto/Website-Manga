import { handleImages } from './routes/images.js';
import { handleUser }   from './routes/user.js';
import { handleWebhook } from './routes/webhook.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      // ── Gambar dari R2 ──────────────────────────────────────────────
      // GET /images/:mangaId/covers/:file
      // GET /images/:mangaId/chapters/:chapterNum/:file
      if (path.startsWith('/images/')) {
        return addCors(await handleImages(request, env, ctx));
      }

      // ── User API (butuh auth — aktifkan nanti) ──────────────────────
      // GET  /api/user/me
      // GET  /api/user/bookmarks
      // POST /api/user/bookmarks
      // GET  /api/user/history
      // POST /api/user/history
      // GET  /api/user/coins
      // POST /api/user/unlock
      if (path.startsWith('/api/user/')) {
        return addCors(await handleUser(request, env));
      }

      // ── Trakteer Webhook ────────────────────────────────────────────
      // POST /api/webhook/trakteer
      if (path === '/api/webhook/trakteer' && method === 'POST') {
        return addCors(await handleWebhook(request, env));
      }

      // ── Health check ────────────────────────────────────────────────
      if (path === '/') {
        return addCors(new Response(JSON.stringify({ status: 'ok', service: 'manga-worker' }), {
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      return addCors(new Response('Not Found', { status: 404 }));

    } catch (err) {
      console.error(err);
      return addCors(new Response('Internal Server Error', { status: 500 }));
    }
  },
};

function addCors(response) {
  const res = new Response(response.body, response);
  Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
