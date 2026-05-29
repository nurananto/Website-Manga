/**
 * User API — bookmark, history, coins, unlock
 * Auth belum aktif, semua return 401 sampai Supabase ditambahkan
 */

export async function handleUser(request, env) {
  const url    = new URL(request.url);
  const path   = url.pathname.replace('/api/user', '');
  const method = request.method;

  // TODO: uncomment saat Supabase auth aktif
  // const user = await getAuthUser(request, env);
  // if (!user) return json({ error: 'Unauthorized' }, 401);

  // Sementara return placeholder
  return json({ error: 'Auth belum aktif' }, 401);

  /*
  // ── Bookmarks ───────────────────────────────────────────────────────
  if (path === '/bookmarks') {
    if (method === 'GET') {
      const rows = await env.DB.prepare(
        'SELECT manga_id, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC'
      ).bind(user.id).all();
      return json(rows.results);
    }
    if (method === 'POST') {
      const { manga_id } = await request.json();
      await env.DB.prepare(
        'INSERT OR IGNORE INTO bookmarks (user_id, manga_id) VALUES (?, ?)'
      ).bind(user.id, manga_id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const { manga_id } = await request.json();
      await env.DB.prepare(
        'DELETE FROM bookmarks WHERE user_id = ? AND manga_id = ?'
      ).bind(user.id, manga_id).run();
      return json({ ok: true });
    }
  }

  // ── History ─────────────────────────────────────────────────────────
  if (path === '/history') {
    if (method === 'GET') {
      const rows = await env.DB.prepare(
        'SELECT manga_id, chapter_id, chapter_number, page, updated_at FROM history WHERE user_id = ? ORDER BY updated_at DESC'
      ).bind(user.id).all();
      return json(rows.results);
    }
    if (method === 'POST') {
      const { manga_id, chapter_id, chapter_number, page = 0 } = await request.json();
      await env.DB.prepare(`
        INSERT INTO history (user_id, manga_id, chapter_id, chapter_number, page, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, manga_id) DO UPDATE SET
          chapter_id = excluded.chapter_id,
          chapter_number = excluded.chapter_number,
          page = excluded.page,
          updated_at = CURRENT_TIMESTAMP
      `).bind(user.id, manga_id, chapter_id, chapter_number, page).run();
      return json({ ok: true });
    }
  }

  // ── Coins ────────────────────────────────────────────────────────────
  if (path === '/coins' && method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT coins FROM users WHERE id = ?'
    ).bind(user.id).first();
    return json({ coins: row?.coins ?? 0 });
  }

  // ── Unlock chapter ───────────────────────────────────────────────────
  if (path === '/unlock' && method === 'POST') {
    const { manga_id, chapter_id } = await request.json();
    const COST = 5;

    const userData = await env.DB.prepare(
      'SELECT coins FROM users WHERE id = ?'
    ).bind(user.id).first();

    if (!userData || userData.coins < COST) {
      return json({ error: 'Koin tidak cukup' }, 402);
    }

    // Cek sudah unlock?
    const already = await env.DB.prepare(
      'SELECT 1 FROM unlocked_chapters WHERE user_id = ? AND chapter_id = ?'
    ).bind(user.id, chapter_id).first();
    if (already) return json({ ok: true, already: true });

    // Transaksi: kurangi koin + catat unlock
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').bind(COST, user.id),
      env.DB.prepare(
        'INSERT INTO unlocked_chapters (user_id, manga_id, chapter_id, coins_spent) VALUES (?, ?, ?, ?)'
      ).bind(user.id, manga_id, chapter_id, COST),
      env.DB.prepare(
        'INSERT INTO coin_transactions (id, user_id, amount, type, note) VALUES (?, ?, ?, "spend", ?)'
      ).bind(crypto.randomUUID(), user.id, -COST, `Unlock ${chapter_id}`),
    ]);

    return json({ ok: true, coins_remaining: userData.coins - COST });
  }

  return json({ error: 'Not Found' }, 404);
  */
}

// ── Auth helper (aktifkan nanti) ─────────────────────────────────────────
// async function getAuthUser(request, env) {
//   const auth = request.headers.get('Authorization');
//   if (!auth?.startsWith('Bearer ')) return null;
//   const token = auth.slice(7);
//   try {
//     const JWKS = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
//     const { payload } = await jwtVerify(token, JWKS);
//     // Auto-create user di D1 kalau belum ada
//     await env.DB.prepare(
//       'INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)'
//     ).bind(payload.sub, payload.email).run();
//     return { id: payload.sub, email: payload.email };
//   } catch { return null; }
// }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
