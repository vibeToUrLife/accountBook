# Account Book

A personal finance tracker built with plain **HTML/CSS/JavaScript** and **Firebase**. Track expenses and income by category, set budgets, view statistics, and sync everything to the cloud. Installable as a PWA on phone and desktop.

🔗 **Live app: https://accbook.vercel.app/**

## Features

### Money tracking
- Add **expense** or **revenue** records (amount + note + date)
- Categories with a budget per category, on a **Monthly**, **Yearly**, or **Lifetime** period
- Category balance auto-updates within the budget period: `balance = budget + revenue - expense`
- **Tags** on records, plus auto-category suggestions and duplicate-record warnings
- **Quick templates** — save common records as one-tap chips
- **Recurring transactions** — auto-add monthly bills/income; months missed while the app was closed are added when it next opens, and a rule on the 31st uses the last day of shorter months
- **Subscriptions** tracking with renewal dates and billing cycles
- **Debts & lending** — track who owes you and what you owe
- **Savings goals** with targets and deadlines; add deposits and withdrawals to each goal, see its history, and the amount needed per month to hit the deadline

### Insights & reporting
- **Statistics** by weekly / monthly / yearly range, with category breakdown and charts
- Spending **projections** (daily average, projected total, days left)
- **Dashboard** — monthly overview, **upcoming** items for the next 14 days (subscription renewals, debt due dates, recurring bills and income, with overdue flags), salary allocation, month-over-month comparison, cashflow chart, spending heatmap, category trends (pick any of your own categories to plot), and budget alerts
- Auto-generated **spending insights**
- Search and **advanced filters** (date range, type, category, amount range, tag)

### Convenience
- **Receipt scanning** — capture/upload a receipt and auto-extract the amount and text; attach photos to records
- **Smart assistant** — add records by voice or text in English / Chinese / mixed
- **Budget alerts** — browser notifications at 80% and over-budget
- **Help & Guide** view explaining every feature in plain words, a "What's this?" link on each screen, and a first-run tip for new users
- **English / 简体中文** interface: switch with the EN / 中文 button in the header; the choice is remembered, and a Chinese browser gets Chinese by default
- Light / **dark mode**
- Custom currency symbol
- **Export** to CSV, JSON, and monthly PDF reports; **import** from JSON backup (restores records with their original ids, so links to categories survive and importing the same file twice doesn't duplicate anything; receipt photos are not part of the backup)
- Installable **PWA** that works offline: the service worker caches the app shell and Firestore keeps a local copy of your data, so records load without a connection and changes made offline sync when you are back online (an "Offline" badge shows in the header)
- Cloud sync via Firebase (Email/Password or Google sign-in + Firestore)

## Firebase setup
1. Create a project at https://console.firebase.google.com/
2. Build → Authentication → Get started → enable **Email/Password**
3. (Optional) Also enable **Google** provider
4. Build → Firestore Database → Create database
5. Project settings → Your apps → Web app → copy the config
6. Copy `firebase-config.example.js` to `firebase-config.js` and fill in the values.

### Fix "This domain is not authorized" on deploy
If the deployed site shows "This domain is not authorized in Firebase Auth.", add your deployed domain in:

- Firebase Console → Authentication → Settings → Authorized domains → Add domain

Examples:
- Vercel: add `accbook.vercel.app` (and any preview/custom domains)
- GitHub Pages: add `YOUR_USERNAME.github.io`
- Custom domain: add your domain (no path)

Then redeploy and refresh.

### Deploy note (important)
This app loads Firebase settings from `./firebase-config.js` at runtime.

If it works locally but shows "Missing Firebase config" after deploy, it usually means `firebase-config.js` was not uploaded/published with your site (common when it was ignored by git or excluded from the hosting "public" folder).

- GitHub Pages / Netlify / Vercel (deploy-from-git): make sure `firebase-config.js` is committed and pushed.
- Firebase Hosting: make sure `firebase-config.js` is inside the folder you deploy (usually `public/`).

Note: Firebase Web config values (like `apiKey`, `authDomain`, etc.) are not secrets; security comes from Auth + Firestore Rules.

If you want extra protection against quota abuse, you can restrict the API key to your site domain in Google Cloud Console (APIs & Services → Credentials → API key restrictions), and/or enable Firebase App Check.

## Run locally
Because this uses ES modules, you should run with a local server (not double-click the HTML file).

### Option A: VS Code Live Server
Install the "Live Server" extension, then open `index.html` and click "Go Live".

### Option B: Python simple server
From this folder run:
- `python -m http.server 5500`

Then open: http://localhost:5500

## Tests
Pure logic (upcoming-items date math, recurring catch-up, subscription renewal dates, money rounding and per-month budgets, savings-goal progress, backup parsing, the translation layer and its dictionary coverage) has unit tests that run on Node 22+ with no dependencies:

- `node --test`

## Project structure
- `index.html` — app shell and all views
- `app.js` — main application logic
- `firebase.js` / `firebase-config.js` — Firebase init and config
- `utils.js` — shared helpers
- `js/i18n.js` / `js/i18n.zh.js` — translation layer and the Simplified Chinese dictionary (English text is the key)
- `js/backup.js` — reads backup files for import (validates every field, keeps record ids)
- `js/boot.js` — applies the saved language before the rest of the app (and the Firebase SDK) has loaded
- `vendor/chart.umd.js` — Chart.js 4.4.1 (MIT, unmodified), served from the site and loaded when Statistics or Dashboard opens
- `js/features/` — feature modules (goals, upcoming, recurring, debts, subscriptions, templates, receipts)
- `tests/` — unit tests for the pure feature logic
- `styles.css` — styling (light/dark theme)
- `manifest.json` / `sw.js` — PWA manifest and service worker
- `vercel.json` — Vercel SPA fallback and cache headers
- `firestore.rules`, `firebase.json`, `.firebaserc` — Firestore security rules and the Firebase CLI config used to deploy them
- `firestore-tests/` — emulator tests for the rules (own `package.json`, kept out of the repository root so Vercel keeps serving the site as plain files)
- `.github/workflows/firestore-rules.yml` — tests and deploys the rules

## Firestore data layout
- `users/{uid}/categories/{categoryId}`
- `users/{uid}/transactions/{txId}`
- (plus collections for goals, recurring rules, debts, and subscriptions under `users/{uid}`)

## Firestore security rules
The rules are in `firestore.rules`. Each signed-in user can read and write only their own `users/{uid}/...` data; a record must have a positive number amount, a known type and a `YYYY-MM-DD` date; the currency label is at most 5 characters; everything else is denied.

- **Tests:** `cd firestore-tests && npm ci && npm test` runs `rules.spec.mjs` against the Firestore emulator (needs Java 11+). It covers the app's own write patterns and checks that other users and signed-out visitors get nothing.
- **Deploy:** `.github/workflows/firestore-rules.yml` runs those tests on every change to the rules and, on `master`, deploys the rules to Firebase once the tests pass.

One-time setup for the automatic deploy:
1. Google Cloud console → IAM & Admin → Service Accounts (project `accountbook-6e296`) → **Create service account**, e.g. `github-firestore-rules`.
2. Give it the **Firebase Rules Admin** role.
3. Open the service account → **Keys** → Add key → Create new key → **JSON** (a file downloads).
4. GitHub repository → Settings → Secrets and variables → Actions → **New repository secret**: name `FIREBASE_SERVICE_ACCOUNT`, value = the whole content of that JSON file. Then delete the downloaded file.
5. GitHub → Actions → **Firestore rules** → Run workflow (later runs start by themselves when `firestore.rules` changes on `master`).

If the deploy step reports a missing permission, give the service account that role as well (for example Service Usage Consumer) and run the workflow again.
