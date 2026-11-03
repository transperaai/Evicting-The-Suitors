# Evicting the Suitors

> "When an impure spirit comes out of a person… it says, 'I will return to the house I left.' When it arrives, it finds the house unoccupied, swept clean and put in order. Then it goes and takes with it seven other spirits more wicked than itself." (Matthew 12:43–45)

Odysseus came home to a house full of suitors eating his food and wasting his days. This app is for taking the house back, **and then filling it with Jesus so nothing has an empty room to return to.**

## The pieces

| Page | What it's for |
|---|---|
| **The Hall** | Everything occupying your life, orbiting a centre circle where you write **who you are** (like Argus, who still knew Odysseus after twenty years). The household (truths standing guard + practices kept this week) circles closest; suitors orbit further out, sized by how much room they take. Dashed ring = being evicted, pulse = showed up in the last 3 days. Hover to see the chain. The page brightens as the house fills with light. |
| **Suitors** | Each fear, habit, loop, lie, sleep problem or kind of inaction. Its card holds the lie underneath it, what it sounds like, what it costs, its triggers (with a **room/location**), the chain (what feeds it, what it feeds) and who occupies its room. |
| **Household** | Truths (scripture you choose) and practices. These are what replace each suitor. |
| **Rooms** | Every location where suitors get in, and the handwritten notes you've placed there. A room with a suitor but no placed note is an **unguarded door**. |
| **Rhythm** | The daily fight: the suitors you're evicting and their replacement practices, a morning sleep log, the day's practices, and an evening "close the house" (hand over what's circling, write tomorrow's top 3, lights-out time). |
| **Log** | Record when a suitor shows up: where, what set it off, gave in / redirected / resisted, whether a note helped. Shows when and where they come. |
| **I'm in a loop** | The pattern interrupt: *"I am looking for certainty. It won't be found here."* Write it down, hand it over, and it's saved to today. |

**Night to day:** the whole app moves through a sunrise as "light in the house" grows (60% practices kept this week, 40% suitors evicted): **Night** (0%, stars) → **Before dawn** (15%) → **Dawn** (35%) → **Morning** (55%, light cards) → **Day** (75%). Tap a stage on the Hall's sunrise strip to preview it. Your identity in the centre keeps the same colours in every stage.

**The Matthew 12 rule:** a suitor can't be set to *being evicted* or *evicted* until at least one truth or practice has been given its room.

## Stack

Next.js 16 (App Router, server actions) on Vercel, Neon Postgres via `@neondatabase/serverless`, `d3-force` for the Hall. Single-user, protected by a passphrase cookie.

## Setup

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL and APP_PASSPHRASE
npm run db:seed              # creates tables + seeds the starting suitors (skips if already seeded)
npm run dev
```

`npm run db:setup` creates or updates the tables without seeding. The seed lives in `scripts/seed-data.mjs`. It was written from your own description, so keep what's true and delete what isn't.

### Environment

| Var | |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (set automatically by the Vercel ↔ Neon integration) |
| `APP_PASSPHRASE` | Unlocks the app. Required in production. |
| `APP_TIMEZONE` | Fallback time zone. Normally the browser reports its own. |
