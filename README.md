# AdvocateX — Influencer Advocacy & Loyalty Ecosystem

> Turn Trusted Recommendations Into Measurable Growth.

AdvocateX is a **frontend-only** SaaS demo that connects brands, shop owners, mechanics and customers through referral campaigns, QR codes, rewards, loyalty points, leaderboards and analytics. Everything runs in the browser on realistic, internally consistent mock data — there is no backend, database, API server or payment integration.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

Requires Node 18+ (tested on Node 22).

The build output in `dist/` is fully static and uses hash routing (`/#/app/...`), so it can be hosted on any static host (Netlify, Vercel, GitHub Pages, S3, an intranet server) with no rewrite rules.

## Demo roles

Use **Launch Demo Dashboard** on the landing page or the quick-access buttons on the login screen.

| Role | Demo user | Lands on | Highlights |
|---|---|---|---|
| Super Admin | Neha Verma | `/app/admin` | Platform KPIs, approval queue, fraud monitor, audit log, payouts |
| Brand Manager | Rohit Kapoor (Veltrix Lubricants) | `/app/brand` | ROI dashboard, campaign builder, products, funnel, ROAS |
| Shop Owner | Vikram Patil (Sai Motors & Spares) | `/app/shop` | Referral code, link & QR, wallet, leaderboard |
| Mechanic Advocate | Arjun Mehta (Mehta Auto Works) | `/app/mechanic` | Tier progress, achievements, referral tools, rewards |
| Customer | Priya Sharma | `/app/customer` | Points, tier, reward catalogue, redemption |

You can also sign in with any demo email (e.g. `mechanic@advocatex.demo`) and any password of 6+ characters.

> **Security note:** demo authentication is client-side only. There are no passwords, tokens or sessions. It is not suitable for production.

## What's included

- **26+ real pages**: landing, login, registration, role selection, forgot password, five role dashboards, network overview, shop & mechanic directories, product catalogue, campaign list / details / create & edit, referral tracking, rewards wallet, loyalty & redemption, analytics, AI insights, fraud monitor, notifications, settings, approval queue, audit log, a public referral landing page (`/#/r/<code>`) and legal pages.
- **Working referral links & QR codes** — each shop/mechanic gets a unique code; the QR encodes the real demo route. Opening it records a simulated click that appears in Referrals and the charts.
- **Consistent numbers everywhere** — every KPI, chart, CSV and AI answer is derived from one simulated event stream through shared formulas in `src/lib/metrics.ts`.
- **Stateful demo actions** — approve advocates, create/edit/pause campaigns, add products, verify or reject purchases, approve rewards, request/approve payouts, redeem rewards, review fraud flags, mark notifications read. All persist in `localStorage` and are recorded in the audit log.
- **CSV exports** for referrals, reward ledgers, analytics reports and the audit log.
- **AI Demo Insights** — a deterministic rule engine (no external AI calls) that produces data-backed insights, recommendations and chat answers.
- Light/dark/system theme, collapsible sidebar, global search (Ctrl/⌘ K), global date range, responsive down to phone width.

## Key formulas

| Metric | Formula |
|---|---|
| Conversion rate | Verified conversions ÷ eligible referral visits (clicks) × 100 |
| Reward redemption rate | Paid-out rewards ÷ approved (redeemable) rewards × 100 |
| Campaign ROAS | Attributed revenue ÷ campaign spend (advocate rewards) |
| Budget utilisation | Lifetime campaign spend ÷ campaign budget × 100 |

Attributed revenue is the purchase value of verified referrals — it is **not** profit. A referral click is never counted as a sale; only verified conversions earn rewards.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui (Radix primitives) · React Router · Zustand · Recharts · Framer Motion · React Hook Form + Zod · Lucide icons · qrcode.react · Sonner toasts

## Project structure

```
src/
  App.tsx                 routes (hash router), lazy-loaded pages, guards
  types/                  domain model shared by store, pages and a future API
  data/
    catalog.ts            brands, advocates, products, rewards catalogue, demo users
    generate.ts           deterministic generator for referrals, rewards, loyalty, fraud flags…
  store/
    data.ts               Zustand "database" + every mutation action (persisted)
    auth.ts               demo auth (role switching, remember-me)
    ui.ts                 theme, sidebar, global date range, notification prefs
  services/api.ts         async service layer — the backend integration seam
  lib/
    metrics.ts            all KPI formulas (funnel, wallet, ROAS, leaderboard, tiers…)
    insights.ts           AI demo insight & assistant engine
    format.ts csv.ts clipboard.ts referral.ts
  hooks/                  useCurrentUser (permissions), useScope (role scoping), useLookups
  components/
    ui/                   shadcn/ui primitives
    shared/               KPI cards, charts, tables kit, status badges, referral toolkit…
    layout/               app shell, sidebar nav, search, date range picker, route guards
  pages/
    public/  dashboards/  app/
```

## Connecting a backend later

1. Keep the types in `src/types` as your API contract (or generate them from OpenAPI).
2. Replace each function body in `src/services/api.ts` with an HTTP call and update the store from the response. Pages already call `api.*` for mutations, so their code does not change.
3. Replace the initial `generateDemoData()` state in `src/store/data.ts` with data fetched on login (or move reads to a query library such as TanStack Query).
4. Replace `src/store/auth.ts` with a real identity provider and enforce roles on the server — the frontend route guards are for UX only.
5. Route any AI assistant or payout provider through your backend. **Never ship API keys to the browser.**

## Resetting the demo

Settings → Demo account → **Reset demo data** regenerates all records (dates are re-anchored to today). Clearing site data in the browser has the same effect.

## Disclaimer

All companies, people, products, figures and testimonials are fictional and for demonstration only. Payouts and redemptions are simulated — no money moves and no messages are sent.
