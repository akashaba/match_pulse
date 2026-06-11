# MatchPulse

A Next.js application for predicting sports match results and competing with friends in private leagues.

## Features

- User registration and JWT login
- League creation and joining with 6-character codes
- Matchday fixtures and score predictions
- Overall standings with exact-score and outcome scoring
- Head-to-head leaderboard and knockout support
- Admin tools for divisions, teams, matchdays, fixtures, and results
- Super-admin user management

## Tech Stack

- **Next.js 14** with React 18 and TypeScript
- **Next App Router** for routes and API handlers
- **Supabase Postgres** for persistence
- **React Query** for client data caching
- **Axios** for browser API requests
- **Tailwind CSS** and existing UI primitives

## Project Structure

```text
sports-pred/
├── frontend/
│   ├── app/                    # Next.js pages and API route handlers
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── api/                # Browser API clients
│   │   ├── components/         # Reusable components
│   │   ├── context/            # React context
│   │   ├── lib/                # Supabase and API helpers
│   │   ├── styles/             # Global styles
│   │   ├── types/              # TypeScript types
│   │   └── views/              # Client-side app views
│   ├── next.config.mjs
│   ├── package.json
│   └── tsconfig.json
└── supabase/
    └── migrations/             # Supabase SQL migrations
```

## Setup

### Prerequisites

- Node.js 18 or higher
- A Supabase project

### Supabase

1. Apply the SQL files in `supabase/migrations/` in order through the Supabase MCP server or Supabase SQL editor.
2. Copy `frontend/.env.example` to `frontend/.env.local`.
3. Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
```

### App

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Default Credentials

The initial Supabase migration seeds:



Seeded data also includes Soccer, English Premier League, Championship, and EPL teams.

## API

The browser calls `/api/...`; those requests are handled by Next route handlers and backed by Supabase.

Important endpoints include:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/leagues`
- `POST /api/leagues`
- `POST /api/leagues/join`
- `GET /api/leagues/{id}/standings`
- `GET /api/divisions/{divisionId}/matchdays`
- `GET /api/matchdays/{matchdayId}/fixtures`
- `POST /api/predictions`
- `POST /api/admin/matchdays`
- `POST /api/admin/fixtures`
- `PUT /api/admin/fixtures/{id}/result`

## Build

```bash
cd frontend
npm run build
npm run start
```

## Development Notes

- Next.js runs on port 3000 by default.
- JWT tokens expire after 24 hours.
- Predictions lock once the matchday deadline passes.
- The Supabase MCP server should be used for database changes when it is connected.
