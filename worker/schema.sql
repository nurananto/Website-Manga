-- MangaFlow D1 Schema
-- Jalankan: wrangler d1 execute manga-db --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  google_id       TEXT UNIQUE,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT,
  avatar_url      TEXT,
  coins           INTEGER DEFAULT 0,
  name_changed_at TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrasi jika tabel sudah ada (jalankan manual jika perlu):
-- ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
-- ALTER TABLE users ADD COLUMN name TEXT;
-- ALTER TABLE users ADD COLUMN avatar_url TEXT;
-- ALTER TABLE users ADD COLUMN name_changed_at TIMESTAMP;

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

-- OAuth state (PKCE-style anti-CSRF untuk login Google)
CREATE TABLE IF NOT EXISTS oauth_states (
  state        TEXT PRIMARY KEY,
  redirect_url TEXT,
  expires_at   TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_exp ON oauth_states(expires_at);

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

-- Komentar per chapter
CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  chapter_id  TEXT NOT NULL,
  manga_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  parent_id   TEXT,              -- NULL = top-level, string = reply ke comment id
  text        TEXT NOT NULL,
  deleted     INTEGER DEFAULT 0, -- 1 = soft delete
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_chapter ON comments(chapter_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent  ON comments(parent_id);

-- Notifikasi per user
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL,     -- 'reply' | 'system'
  actor_name  TEXT,
  manga_id    TEXT,
  manga_title TEXT,
  chapter_num REAL,
  comment_id  TEXT,
  preview     TEXT,
  read        INTEGER DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
