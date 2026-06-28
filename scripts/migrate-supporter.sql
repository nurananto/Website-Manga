-- ════════════════════════════════════════════════════════════════════
-- Migrasi: sistem Coin → Supporter
-- Jalankan BERTAHAP. Verifikasi hasil langkah 1-3 sebelum DROP (langkah 5).
--   wrangler d1 execute manga-db --remote --file=scripts/migrate-supporter.sql
-- (atau paste per-blok di D1 Console)
-- ════════════════════════════════════════════════════════════════════

-- 1) Kolom supporter_until di users (ISO timestamp; NULL = bukan supporter).
ALTER TABLE users ADD COLUMN supporter_until TEXT;

-- 2) Migrasi donatur lama → Supporter.
--    Semua user yang pernah donasi Trakteer (amount > 0):
--    supporter_until = tanggal donasi TERAKHIR + 30 hari.
UPDATE users
SET supporter_until = datetime(
  (SELECT MAX(ct.created_at) FROM coin_transactions ct
   WHERE ct.user_id = users.id AND ct.type = 'trakteer' AND ct.amount > 0),
  '+30 days'
)
WHERE EXISTS (
  SELECT 1 FROM coin_transactions ct
  WHERE ct.user_id = users.id AND ct.type = 'trakteer' AND ct.amount > 0
);

-- 3) Tabel donasi (dedup webhook + audit) — menggantikan coin_transactions utk donasi.
CREATE TABLE IF NOT EXISTS donations (
  trakteer_ref TEXT PRIMARY KEY,
  email        TEXT,
  user_id      TEXT,
  amount       INTEGER,                 -- rupiah
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(email);

-- 4) VERIFIKASI dulu (jalankan & cek hasilnya benar) sebelum lanjut ke langkah 5:
--   SELECT id, email, supporter_until FROM users WHERE supporter_until IS NOT NULL;

-- 5) HAPUS TOTAL sistem coin (jalankan SETELAH verifikasi langkah 2 benar).
--    Dikomentari demi keamanan — buka komentar lalu jalankan saat sudah yakin.
-- DROP TABLE IF EXISTS coin_transactions;
-- DROP TABLE IF EXISTS unlocked_chapters;
-- DROP TABLE IF EXISTS device_claims;
-- DROP TABLE IF EXISTS device_accounts;
-- DROP TABLE IF EXISTS banned_devices;
-- ALTER TABLE users DROP COLUMN coins;
-- ALTER TABLE users DROP COLUMN daily_claim_at;
