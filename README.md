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

## Database

Schema tersedia di `worker/schema.sql`.
