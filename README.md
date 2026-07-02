# SiteTracker Pro

Premium mobile-first construction business management PWA for contractors.

Built with Next.js App Router, React 19, TypeScript strict mode, Ionic React mobile shell, Radix/shadcn-style reusable components, Supabase, TanStack Query, Dexie offline queue, React Hook Form, Zod, PDF/CSV/Excel export, PWA install support, and GitHub Pages static export.

## What Is Included

- Login, signup, logout, session persistence, offline mode
- Company onboarding and company-owned data separation
- Mobile app shell with five labeled bottom tabs, safe-area support, Add button, Ask AI button, sheets, cards, and dark mode
- Sites, labour, attendance, materials, suppliers, expenses, client payments, supplier payments, progress, reminders, staff
- Dashboard with active sites, daily costs, pending payments, labour balance, monthly profit/loss, alerts, and activity
- Reports with PDF, CSV, and Excel-compatible export
- AI assistant through Supabase Edge Functions, with local fallback parser and confirmation before saving
- Smart memory, notifications, audit logs, and data health screens
- Dexie offline local database and retryable sync queue
- Supabase SQL schema with RLS, indexes, duplicate-prevention constraints, storage policies, and pgvector memory table
- PWA manifest, service worker, offline fallback, app icon, and GitHub Pages deployment workflow
- Vitest unit tests and Playwright mobile smoke test

## Local Run

```powershell
$env:Path='C:\Program Files\nodejs;' + $env:Path
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

If Supabase env vars are not configured, the app opens in offline mode so you can test the UI and local storage.

## Environment Variables

Copy `.env.example` to `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_APP_NAME=SiteTracker Pro
```

Only use the Supabase anon/public key in the frontend. Do not put service role keys or OpenAI keys in the browser.

## Supabase Setup

1. Open Supabase SQL Editor.
2. Paste and run `supabase/schema.sql`.
3. In Supabase Edge Functions, deploy:

```bash
supabase functions deploy ai-assistant
supabase functions deploy voice-parser
```

4. Add Edge Function secrets:

```bash
supabase secrets set OPENAI_API_KEY=your_key
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
```

The AI functions use the logged-in user's JWT and RLS-protected queries. The app never exposes the OpenAI key.

## GitHub Pages Deployment

The workflow is at `.github/workflows/deploy.yml`.

In GitHub repository settings:

1. Go to `Settings > Pages`.
2. Select `GitHub Actions`.
3. Add repository secrets:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Push to `main` or run the workflow manually.

Manual build check:

```powershell
npm run export:check
```

For GitHub Pages, the workflow sets:

```text
NEXT_PUBLIC_BASE_PATH=/${{ github.event.repository.name }}
```

## Install On iPhone

1. Open the GitHub Pages site in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Open SiteTracker Pro from the home screen.

## Install On Android

1. Open the GitHub Pages site in Chrome.
2. Tap the menu.
3. Tap Install app or Add to Home screen.
4. Open SiteTracker Pro from the launcher.

## Reports

Reports export from current local/Supabase records:

- PDF through `jspdf`
- CSV through browser download
- Excel-compatible `.xls` through HTML workbook export

On iPhone Safari, generated files open through the browser download/share sheet.

## Testing

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Current unit coverage checks:

- Money/dashboard calculations
- Zod validation
- AI draft parsing safety
- Role permissions

## Data Protection Rules

Every business record carries:

- `company_id`
- `site_id` where applicable
- `created_by`, `updated_by`
- `source`
- `sync_status`
- `idempotency_key`
- `archived`
- timestamps

Supabase RLS restricts data by company. Admin, staff, and viewer roles are enforced in the app and in database policies.
