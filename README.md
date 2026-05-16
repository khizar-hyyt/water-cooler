# 💧 AquaShift – Water Cooler Duty Tracker

Track who fills the water cooler fairly among roommates. Deploy once, share the link — everyone sees the same data on every phone and computer.

## How it works

- Everyone opens the shared app link and taps their name
- Whoever fills the cooler taps **"Mark My Turn Complete"**
- The app tracks turns, suggests who should go next, and carries missed duties to the next day
- Mark yourself **Away** to be excluded from fairness calculations that day
- Open **People** in the bottom nav to add roommates, rename them, or remove them

Data is stored on the server (not in each browser), so all devices stay in sync.

## Manage roommates

Use the **People** tab to:

- **Add** a roommate (name, emoji, color)
- **Edit** a name (pencil icon)
- **Remove** someone (trash icon; past turns stay in history)

No need to edit code anymore.

## Deploy to Vercel

**1. Push to GitHub** (if you have not already)

**2. Import on [vercel.com](https://vercel.com)** and deploy

**3. Enable shared storage (required for production)**

On Vercel, data must live in **Vercel KV** (otherwise each server instance would not share state):

1. Open your project on Vercel → **Storage** → **Create Database** → **KV**
2. Connect it to the project — Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically
3. **Redeploy** the app

Without KV, `npm run dev` still works locally (data is saved in `.data/state.json` on your machine).

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Local dev uses a `.data/state.json` file so you can test without Vercel KV. Only that computer sees that file until you deploy with KV.

## Stack

- Next.js 14 (App Router)
- React + TypeScript
- Tailwind CSS
- Vercel KV (production) / local JSON file (development)
