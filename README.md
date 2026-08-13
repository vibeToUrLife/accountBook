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
- **Recurring transactions** — auto-add monthly bills/income
- **Subscriptions** tracking with renewal dates and billing cycles
- **Debts & lending** — track who owes you and what you owe
- **Savings goals** with targets, deadlines, and progress

### Insights & reporting
- **Statistics** by weekly / monthly / yearly range, with category breakdown and charts
- Spending **projections** (daily average, projected total, days left)
- **Dashboard** — monthly overview, salary allocation, month-over-month comparison, cashflow chart, spending heatmap, category trends, and budget alerts
- Auto-generated **spending insights**
- Search and **advanced filters** (date range, type, category, amount range, tag)

### Convenience
- **Receipt scanning** — capture/upload a receipt and auto-extract the amount and text; attach photos to records
- **Smart assistant** — add records by voice or text in English / Chinese / mixed
- **Budget alerts** — browser notifications at 80% and over-budget
- Light / **dark mode**
- Custom currency symbol
- **Export** to CSV, JSON, and monthly PDF reports; **import** from JSON backup
- Installable **PWA** with offline service worker
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

## Project structure
- `index.html` — app shell and all views
- `app.js` — main application logic
- `firebase.js` / `firebase-config.js` — Firebase init and config
- `utils.js` — shared helpers
- `js/features/` — feature modules (goals, recurring, debts, subscriptions, templates, receipts)
- `styles.css` — styling (light/dark theme)
- `manifest.json` / `sw.js` — PWA manifest and service worker
- `vercel.json` — Vercel SPA fallback and cache headers

## Firestore data layout
- `users/{uid}/categories/{categoryId}`
- `users/{uid}/transactions/{txId}`
- (plus collections for goals, recurring rules, debts, and subscriptions under `users/{uid}`)

## Minimal security rules (starter)
In Firebase Console → Firestore → Rules, you can start with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

(Adjust for your needs.)
