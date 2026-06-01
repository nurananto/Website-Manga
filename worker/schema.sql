-- MangaFlow D1 Schema
-- Jalankan: wrangler d1 execute manga-db --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,       -- dari Supabase auth (UUID)
  email       TEXT UNIQUE NOT NULL,
  coins       INTEGER DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id     TEXT NOT NULL,
  manga_id    TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, manga_id)
);

CREATE TABLE IF NOT EXISTS history (
  user_id        TEXT NOT NULL,
  manga_id       TEXT NOT NULL,
  chapter_id     TEXT NOT NULL,
  chapter_number REAL NOT NULL,
  page           INTEGER DEFAULT 0,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, manga_id)
);

CREATE TABLE IF NOT EXISTS unlocked_chapters (
  user_id        TEXT NOT NULL,
  manga_id       TEXT NOT NULL,
  chapter_id     TEXT NOT NULL,
  coins_spent    INTEGER DEFAULT 5,
  unlocked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  amount         INTEGER NOT NULL,     -- positif = masuk, negatif = keluar
  type           TEXT NOT NULL,        -- 'trakteer' | 'spend' | 'admin'
  trakteer_ref   TEXT UNIQUE,          -- deduplikasi webhook
  note           TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- View counter per chapter (deduplikasi per IP)
CREATE TABLE IF NOT EXISTS chapter_views (
  chapter_id  TEXT NOT NULL,
  ip_hash     TEXT NOT NULL,          -- hash(IP + chapter_id), bukan IP asli
  viewed_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chapter_id, ip_hash)   -- otomatis deduplikasi
);

-- Status sync ke GitHub (1 baris saja)
CREATE TABLE IF NOT EXISTS sync_log (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  last_attempt TIMESTAMP,
  last_success TIMESTAMP,
  status       TEXT DEFAULT 'pending'  -- 'ok' | 'pending' | 'failed'
);

INSERT OR IGNORE INTO sync_log (id, status) VALUES (1, 'pending');

-- Rate limiting per IP per menit
CREATE TABLE IF NOT EXISTS rate_limits (
  key    TEXT PRIMARY KEY,
  count  INTEGER DEFAULT 1,
  minute INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rate_minute ON rate_limits(minute);

-- Ban permanen / sementara
CREATE TABLE IF NOT EXISTS banned_ips (
  ip         TEXT PRIMARY KEY,
  reason     TEXT,
  banned_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP            -- NULL = permanen
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_bookmarks_user     ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user       ON history(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_user      ON unlocked_chapters(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user  ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_views_chapter      ON chapter_views(chapter_id);

-- Chapter lock timestamps (diisi via /api/admin/sync-locks dari GitHub Action)
CREATE TABLE IF NOT EXISTS chapter_locks (
  chapter_id TEXT PRIMARY KEY,
  unlock_at  TEXT NOT NULL  -- ISO timestamp kapan chapter jadi gratis
);
