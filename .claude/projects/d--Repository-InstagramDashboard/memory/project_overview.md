---
name: Project Overview
description: Stack, architecture, auth, data persistence, and key file map for InstagramDashboard
type: project
---

Next.js 14 App Router dashboard for Instagram analytics and content ideas.

**Stack:** Next.js 14, React 18, Tailwind CSS, Recharts, Apify (scraping), Anthropic/OpenAI/Gemini (AI), bcryptjs (auth)

**Data persistence:** File-based via `/data/*.json`. Cache API at `/api/cache` (GET/POST) is the universal read/write mechanism. All client code uses `loadCache(key)` / `saveCache(key, data)` helper functions.

**Auth pattern:** bcryptjs in Node.js API route (`/api/auth/login`), HMAC-SHA256 session tokens via Web Crypto in Edge middleware (`src/middleware.ts`). Credentials in `.env.local` (AUTH_USERNAME, AUTH_PASSWORD_HASH, AUTH_SECRET).

**Key cache keys:** `my_reels`, `competitors`, `content_ideas`, `competitor_expand_state`, `prompt_templates`, `analysis_settings`, `idea_selection`, `settings`, `recycle_bin`

**Settings system:** `/api/settings` (GET/POST) reads/writes `/data/settings.json` with defaults. Fields: instagramUsername, autoSignoutMinutes, recycleBinDays, displayName, myReelsScrapeLimit. page.tsx loads it as the 8th item in the startup Promise.all.

**Recycle bin:** `/api/recycle-bin` (GET/POST/DELETE). Items: `{ id, type: 'idea'|'competitor', label, data, deletedAt }`. Filtered by `recycleBinDays` setting. Idea deletions send to recycle bin automatically.

**Key pages:** `/` (dashboard), `/login`, `/settings`, `/recycle-bin`

**New API routes added (settings session):** `/api/settings`, `/api/upload-profile`, `/api/backup`, `/api/recycle-bin`