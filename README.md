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

Vercel no longer has a standalone “KV” button. Use **Upstash Redis** from the Marketplace (this is what powers shared data):

1. Open your **water-cooler** project on [vercel.com](https://vercel.com)
2. Go to the **Storage** tab (left sidebar), or open [vercel.com/marketplace/upstash](https://vercel.com/marketplace/upstash)
3. Click **Install** on **Upstash** → choose **Upstash for Redis** (sometimes labeled “Upstash KV”)
4. Sign in / create a free Upstash account when prompted
5. **Create a new Redis database** (or pick an existing one) and **link it to your Vercel project**
6. Vercel will add env vars like `KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
7. **Redeploy** the project (Deployments → ⋯ on latest → Redeploy)

After redeploy, the login screen should say **“Synced across all devices”** (not “local dev”).

Without this, production may not share data between phones. Local `npm run dev` still uses `.data/state.json` on your PC.

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
