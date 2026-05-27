# ⚾ Pitch Tracking

A high school baseball pitch scouting app. Log pitches in-game, track tendencies by count, batter handedness, and game situation. Works offline with localStorage, or sync across devices with Supabase.

## Features

- **Home screen** — all scouted games with pitch count and strike %
- **Game logging** — pitch type, count, batter hand, location (click-to-place), result, situation tags
- **Tendencies tab** — pitch mix, count breakdowns, situation breakdowns, stats
- **Heat map tab** — filterable strike zone frequency map
- **Pitch feed** — full log with delete, filter by type/result
- **Cross-game tendencies** — aggregate all games per pitcher
- **Export** — plain-text scouting report
- **Cloud sync** — optional Supabase backend

## Quick Start (local dev)

```bash
npm install
npm run dev
```

Open http://localhost:5173 — works fully offline with localStorage, no setup needed.

## Supabase Setup (cloud sync)

1. Create a free project at https://supabase.com
2. Run this SQL in the SQL Editor:

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  date text not null,
  my_team text not null,
  opponent text not null,
  pitcher_name text not null,
  pitcher_throws text not null,
  pitcher_number text,
  notes text,
  pitches jsonb default '[]'::jsonb
);

alter table games enable row level security;
create policy "public access" on games for all using (true);
```

3. Create a `.env` file:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. `npm run build` — done.

## GitHub Pages Deployment

1. Push to GitHub
2. Go to Settings → Pages → Source: GitHub Actions
3. Add Repository Secrets: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Push to `main` — auto-deploys via `.github/workflows/deploy.yml`

Your app will be live at `https://yourusername.github.io/pitcher-scout/`

## Tech Stack

- React 18 + React Router
- Vite
- Supabase (optional)
- No UI library — custom CSS
