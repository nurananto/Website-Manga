/**
 * Trakteer Webhook
 * POST /api/webhook/trakteer
 *
 * Setup di Trakteer:
 *   Dashboard → Integrasi → Webhook URL: https://manga-worker.xxx.workers.dev/api/webhook/trakteer
 *   Secret key → simpan di Cloudflare Worker Variables sebagai TRAKTEER_SECRET
 *
 * Mapping donasi → koin (sesuaikan dengan kebutuhan):
 *   Rp  5.000 =  50 koin
 *   Rp 10.000 = 100 koin
 *   Rp 20.000 = 200 koin + bonus 20
 *   Rp 50.000 = 500 koin + bonus 100
 */

const COIN_MAP = [
  { min: 50000, coins: 600 },   // Rp 50.000 → 600 koin (bonus 100)
  { min: 20000, coins: 220 },   // Rp 20.000 → 220 koin (bonus 20)
  { min: 10000, coins: 100 },   // Rp 10.000 → 100 koin
  { min:  5000, coins:  50 },   // Rp  5.000 →  50 koin
  { min:     0, coins:  10 },   // minimal   →  10 koin
];

function calculateCoins(amount) {
  for (const tier of COIN_MAP) {
    if (amount >= tier.min) return tier.coins;
  }
  return 0;
}

export async function handleWebhook(request, env) {
  const body = await request.text();

  // Verifikasi signature Trakteer (HMAC-SHA256)
  if (env.TRAKTEER_SECRET) {
    const signature = request.headers.get('X-Trakteer-Signature') || '';
    const expected  = await hmacSha256(env.TRAKTEER_SECRET, body);
    if (signature !== expected) {
      return json({ error: 'Invalid signature' }, 401);
    }
  }

  let data;
  try { data = JSON.parse(body); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const {
    payment_id,         // ID unik tiap transaksi Trakteer
    supporter_email,    // email donatur
    supporter_name,
    amount,             // nominal dalam Rupiah
    message,
  } = data;

  if (!payment_id || !supporter_email || !amount) {
    return json({ error: 'Missing fields' }, 400);
  }

  // Deduplikasi — skip kalau payment_id sudah diproses
  const existing = await env.DB.prepare(
    'SELECT id FROM coin_transactions WHERE trakteer_ref = ?'
  ).bind(payment_id).first();

  if (existing) {
    return json({ ok: true, duplicate: true });
  }

  const coins = calculateCoins(amount);
  if (coins === 0) return json({ ok: true, coins: 0 });

  // Auto-create user kalau belum ada
  await env.DB.prepare(
    'INSERT OR IGNORE INTO users (id, email, coins) VALUES (?, ?, 0)'
  ).bind(`trakteer-${supporter_email}`, supporter_email).run();

  // Tambah koin + catat transaksi
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE users SET coins = coins + ? WHERE email = ?'
    ).bind(coins, supporter_email),

    env.DB.prepare(`
      INSERT INTO coin_transactions (id, user_id, amount, type, trakteer_ref, note)
      VALUES (?, (SELECT id FROM users WHERE email = ?), ?, 'trakteer', ?, ?)
    `).bind(
      crypto.randomUUID(),
      supporter_email,
      coins,
      payment_id,
      `Donasi dari ${supporter_name || supporter_email}: Rp ${amount.toLocaleString('id')}`
    ),
  ]);

  console.log(`Trakteer: ${supporter_email} +${coins} koin (Rp ${amount})`);
  return json({ ok: true, coins_added: coins });
}

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
