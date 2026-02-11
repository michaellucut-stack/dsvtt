# Local Development Setup

## Prerequisites

1. **Docker Desktop** (for PostgreSQL container)
2. **Node.js** (v20+ required, v24 works)
3. **pnpm** - install via: `npm install -g pnpm`

## Steps to Launch

```bash
# 1. Start PostgreSQL via Docker
docker run -d --name dsvtt-postgres -e POSTGRES_USER=dsvtt -e POSTGRES_PASSWORD=dsvtt_dev -e POSTGRES_DB=dsvtt -p 5432:5432 postgres:16-alpine

# 2. Copy env file
copy .env.example .env

# 3. Install dependencies
pnpm install

# 4. Generate Prisma client + run migrations + seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Build shared packages first
npx tsc --build packages/shared packages/events packages/auth packages/dice-engine packages/game-engine

# 6. Start backend (terminal 1)
cd apps/server
npx tsx src/index.ts

# 7. Start frontend (terminal 2)
cd apps/web
npx next dev
```

## What's Available to Test

| Feature | URL / Action |
|---|---|
| **Landing page** | `http://localhost:3000` |
| **Register** | `/register` - create account (displayName, email, password) |
| **Login** | `/login` - sign in, redirects to lobby |
| **Lobby** | `/lobby` - see room list, create rooms |
| **Create room** | Click "Create Room" in lobby, set name + max players |
| **Join room** | Click a room card, join as Player |
| **Game room** | `/[roomId]` - map canvas, sidebar tabs |
| **Map canvas** | Pan (drag), zoom (mousewheel), grid overlay |
| **Dice roller** | Sidebar "Dice" tab - type `2d6+3` or click d20 quick button |
| **Chat** | Sidebar "Chat" tab - IC/OOC channels, send messages |
| **Character sheet** | Sidebar "Party" tab - create character, add stats/inventory |
| **Shared notes** | Sidebar "Notes" tab - create/edit collaborative notes |
| **Director panel** | Sidebar "DM" tab (director only) - manage NPCs, world events |
| **Turn tracker** | Bar above map - set initiative, next/skip turn (director) |
| **Health check** | `http://localhost:4000/health` |
| **API direct** | `http://localhost:4000/api/auth/register` (POST) |

## Test Accounts (after seed)

| Email | Password | Role |
|---|---|---|
| `director@test.com` | `password123` | Director |
| `player@test.com` | `password123` | Player |

## Multi-user Testing

Open two browser windows (one normal, one incognito). Log in as director in one, player in the other. Join the same room to test real-time sync: token moves, chat messages, dice rolls, and turn tracking all broadcast between clients.
