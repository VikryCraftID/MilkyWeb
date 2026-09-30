# Milky Interactive — Website

Frontend statis untuk Milky Interactive (WhatsApp bot). Di-deploy ke Vercel.

## Isi

- `public/` — landing page, Wordle web, Downloader page, Donate page (HTML/CSS/JS murni, self-contained)
- `api/proxy.js` — satu-satunya serverless function; forward semua `/api/*` ke backend bot
- `vercel.json` — rewrite rules

## Cara kerja

```
Browser  →  milkyinteractive.my.id  →  Vercel (repo ini)
                                     →  /api/*  →  proxy.js  →  node.termai.cc:3510 (bot Milky)
```

Semua logika (wordle, downloader, database user) ada di backend bot. Repo ini cuma hosting
halaman statis + proxy, jadi **tidak ada kode bot di sini**.

## Deploy

1. Import repo ini ke Vercel.
2. Tidak perlu env variable (backend URL hardcoded di `api/proxy.js`).
3. Deploy. Domain: `milkyinteractive.my.id`.
