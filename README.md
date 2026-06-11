# Nurananto Scanlation

Website baca manga scanlation Indonesia, dibangun dengan React + Vite dan dihosting di Cloudflare.

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion |
| API | Cloudflare Workers (api-worker) |
| Gambar | Cloudflare Workers + R2 (image-worker) |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Cloudflare Pages |
| Auth | Google OAuth 2.0 + custom JWT (HS256) |
| Donasi | Trakteer webhook → koin otomatis |

## Fitur

- Baca manga gratis & berbayar (koin)
- Login via Google
- Komentar & balasan per chapter
- Notifikasi reply
- Riwayat baca & riwayat transaksi koin
- Pembelian koin via Trakteer (otomatis diklaim)
- View counter per chapter

## Struktur

```
├── src/                  # Frontend React
│   ├── components/       # UI components
│   ├── lib/auth.js       # Custom auth utilities
│   └── App.jsx           # Main app
├── worker/
│   ├── api-worker.js     # Cloudflare Worker (API + OAuth)
│   ├── image-worker.js   # Cloudflare Worker (R2 images)
│   └── schema.sql        # D1 database schema
├── public/manga/         # Katalog manga (di-generate otomatis)
└── .github/workflows/    # CI/CD (build catalog, backup D1)
```

## Setup Worker

Bindings yang diperlukan di Cloudflare Dashboard:

**api-worker:**
```
D1        → DB                  → database: manga-db
Var       → JWT_SECRET          → string acak min 32 karakter
Var       → TOKEN_SECRET        → sama dengan image-worker
Var       → ADMIN_SECRET        → untuk GitHub Action sync locks
Var       → TRAKTEER_SECRET     → dari Trakteer
Var       → GOOGLE_CLIENT_ID    → dari Google Cloud Console
Var       → GOOGLE_CLIENT_SECRET
Var       → REDIRECT_BASE       → https://nuranantoscans.my.id
Var       → ALLOWED_ORIGINS     → nuranantoscans.my.id,nuranantoweb.pages.dev
Var       → GITHUB_TOKEN        → untuk cron push views
Var       → GITHUB_REPO         → nurananto/Website-Manga
```

**image-worker:**
```
R2        → R2                  → bucket: manga-media
D1        → DB                  → database: manga-db
Var       → TOKEN_SECRET        → sama dengan api-worker
Var       → ALLOWED_ORIGINS     → nuranantoscans.my.id,nuranantoweb.pages.dev
```

## Setup Frontend

```bash
cp .env.example .env
# Isi VITE_WORKER_URL dengan URL api-worker kamu

npm install
npm run dev
```

**Cloudflare Pages Build Command:**
```bash
echo "{\"v\":\"$(date +%s)\",\"label\":\"$(date +'%-d %b %Y')\",\"type\":\"code\"}" > public/version.json && npm run build
```

## GitHub Secrets

Untuk workflow CI/CD:

| Secret | Keterangan |
|---|---|
| `WORKER_URL` | URL api-worker |
| `WORKER_ADMIN_SECRET` | Sama dengan ADMIN_SECRET di Worker |
| `CF_API_TOKEN` | Cloudflare API token (untuk backup D1) |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |

## Database

Init schema:
```bash
wrangler d1 execute manga-db --file=worker/schema.sql --remote
```

Backup manual:
```bash
wrangler d1 export manga-db --output=backup.sql --remote
```
(Atau via GitHub Actions → Backup D1 Database → Run workflow)
