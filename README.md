# 💧 AquaShift – Water Cooler Duty Tracker

Track who fills the water cooler fairly among roommates. No backend, no signup, no config — just deploy and share the link.

## How it works

- Everyone opens the app on their phone and taps their name
- Whoever fills the cooler taps **"Mark My Turn Complete"**
- The app tracks turns, suggests who should go next, and carries missed duties to the next day
- Mark yourself **Away** to be excluded from fairness calculations that day

> ⚠️ Data is stored in each person's browser (localStorage). For a shared view, open the app on one shared device/tablet, or use it individually and just track your own turns.

## Customize roommates

Edit **`src/lib/store.ts`** and change the `ROOMMATES` array:

```ts
export const ROOMMATES = [
  { id: "r1", name: "Ahmed",  emoji: "🧑", color: "#38bdf8" },
  { id: "r2", name: "Hassan", emoji: "👨", color: "#34d399" },
  // add or remove entries...
];
```

Don't change existing `id` values after people have started using the app.

## Deploy to Vercel (2 steps)

**1. Push to GitHub**
```bash
git init && git add . && git commit -m "init"
# create a repo on github.com, then:
git remote add origin https://github.com/YOUR_NAME/aquashift.git
git push -u origin main
```

**2. Deploy on Vercel**
- Go to [vercel.com](https://vercel.com) → New Project → Import your repo
- Click **Deploy** — no environment variables needed!
- Share the URL with your roommates

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Stack

- Next.js 14 (App Router)
- React + TypeScript
- Tailwind CSS
- localStorage (no database needed)
