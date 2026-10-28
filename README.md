# MAXR Teamspace (MAXR ONE Staff Management)

Internal web platform for workforce management: users & roles, employee directory, attendance & shifts, leave management, projects & tasks, meetings & expenses, notifications, reports & administration.

---

## Architecture & Monorepo Structure

The repository is organized as a **Modular Monolith** using npm / pnpm workspaces:

```text
maxr-teamspace/
├── apps/
│   ├── api/                    # Node.js + Express + TypeScript Backend API
│   │   ├── src/
│   │   │   ├── config/         # Environment variable validation & configuration
│   │   │   ├── db/             # Plain SQL migrator, seeder, pg pool, and redis clients
│   │   │   │   ├── migrations/ # Versioned plain SQL migrations (No Prisma)
│   │   │   │   ├── seeds/      # Repeatable development seed scripts
│   │   │   │   ├── client.ts   # PostgreSQL connection pool & health checker
│   │   │   │   ├── redis.ts    # Redis client & health checker
│   │   │   │   ├── migrator.ts # Plain SQL migration runner
│   │   │   │   └── seeder.ts   # Development database seeder
│   │   │   ├── middleware/     # Request ID, error envelope, security middleware
│   │   │   ├── modules/        # Layered business modules (routes -> service -> repository)
│   │   │   │   └── _template/  # Reference implementation for new modules
│   │   │   ├── app.ts          # Express application initialization & health endpoints
│   │   │   └── server.ts       # Server bootstrap & graceful shutdown
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                    # React 18 + TypeScript + Vite Frontend SPA
│       ├── src/
│       │   ├── features/       # Feature modules (components, pages, api, types)
│       │   │   └── _template/  # Reference feature pattern
│       │   ├── App.tsx         # Responsive application shell & role switcher
│       │   ├── index.css       # Tailwind & CSS variable design tokens
│       │   └── main.tsx        # React DOM entry point
│       ├── tailwind.config.js  # Authoritative brand tokens & responsive breakpoints
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   └── shared/                 # Shared TypeScript contracts, error envelopes & constants
│       ├── src/
│       │   ├── constants/      # Roles, scopes, workflow states, brand tokens
│       │   ├── types/          # API envelopes, pagination, user/employee models
│       │   └── index.ts        # Shared module barrel export
│       ├── package.json
│       └── tsconfig.json
├── docs/                       # Architecture decisions (ADRs), requirements & planning
│   ├── architecture/
│   │   └── decisions/          # Recorded Architecture Decision Records (D-02..D-05, D-09)
│   ├── development/            # Developer onboarding & guides
│   │   └── local-setup.md      # Detailed local development environment guide (TL-02)
│   ├── project-planning/       # Work breakdown, gap analysis & roadmap
│   └── requirements/           # Product baseline & role permission matrix
├── docker-compose.yml          # Local infrastructure: PostgreSQL 16, Redis 7, Mailpit, S3 mock
├── .env.example                # Safe environment variable template
├── .eslintrc.cjs               # Shared TypeScript ESLint configuration
├── .prettierrc                 # Code formatting configuration
├── package.json                # Root workspace orchestration
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── tsconfig.json               # Root strict TypeScript configuration
└── AGENTS.md                   # Authoritative repository rules for developers & AI agents
```

---

## Verified Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite, Tailwind CSS (desktop + mobile web responsive) |
| **Backend** | Node.js + Express + TypeScript, strictly layered (`routes -> service -> repository`) |
| **Database** | PostgreSQL 16 (strict constraints, partial unique indexes for attendance) |
| **Migrations** | Versioned Plain SQL migrations (Strictly **No Prisma**) |
| **Shared Package** | Monorepo workspace package (`@maxr/shared`) |
| **Cache & Sessions** | Redis 7 (temporary caching, session storage, and rate-limiting) |
| **Email Sink** | Mailpit (local SMTP sink and web inspector) |
| **Object Storage** | S3-compatible private storage mock (Adobe S3Mock) |

---

## Local Infrastructure Services (Docker Compose)

| Service | Container Name | Host Port | Purpose | Health Check |
|---|---|---|---|---|
| **PostgreSQL 16** | `maxr-postgres` | `5432` | Authoritative relational database | `pg_isready -U postgres -d maxr_teamspace` |
| **Redis 7** | `maxr-redis` | `6379` | Ephemeral cache & sessions | `redis-cli ping` |
| **Mailpit** | `maxr-mailpit` | `1025` (SMTP), `8025` (Web UI) | Local email testing & inspection | `nc -z localhost 1025` |
| **S3 Storage Mock** | `maxr-storage` | `9000` (HTTP) | S3-compatible private object storage | `nc -z localhost 9090` |

All services use named volumes (`postgres_data`, `redis_data`, `mailpit_data`, `storage_data`) for persistent data across container restarts.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (`node -v` >= 18)
- **Package Manager**: `npm` (v9+) or `pnpm` (v9+)
- **Docker**: Docker Desktop / Engine running with Docker Compose v2+ (`docker compose version`)
- **Git**: Installed and configured

---

## Quick Start Local Setup (< 30 minutes)

### 1. Clone & Configure Environment
```bash
git clone https://github.com/arun-kumar-001/maxr-teamspace.git
cd maxr-teamspace

# Copy safe environment template
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Local Docker Services
```bash
npm run docker:up
```
Verify that all services are healthy:
```bash
npm run docker:status
```

### 4. Run Migrations & Seed Database
```bash
# Run plain SQL migrations (applies apps/api/src/db/migrations/*.sql)
npm run db:migrate

# Seed local development data (safe guard prevents execution in production)
npm run db:seed
```

### 5. Start Development Servers
```bash
# Terminal 1: Backend Express API (http://localhost:4000)
npm run dev:api

# Terminal 2: Frontend React SPA (http://localhost:3000)
npm run dev:web
```

---

## API Health Check

The API exposes dependency-aware health check endpoints:
- `GET /api/health`
- `GET /api/v1/health`

### Example Response:
```bash
curl http://localhost:4000/api/health
```

```json
{
  "status": "healthy",
  "service": "maxr-api",
  "version": "0.1.0",
  "environment": "development",
  "uptimeSeconds": 120,
  "timestamp": "2026-10-28T17:30:00.000Z",
  "dependencies": {
    "database": {
      "status": "up",
      "latencyMs": 2
    },
    "redis": {
      "status": "up",
      "latencyMs": 1
    }
  }
}
```

---

## Local Service Dashboards

- **Web Application:** [http://localhost:3000](http://localhost:3000)
- **Backend API Health:** [http://localhost:4000/api/health](http://localhost:4000/api/health)
- **Mailpit Email Web UI:** [http://localhost:8025](http://localhost:8025)
- **S3 Storage Mock Endpoint:** [http://localhost:9000](http://localhost:9000)

---

## Available Scripts

| Script | Purpose |
|---|---|
| `npm run docker:up` | Starts PostgreSQL, Redis, Mailpit, and Storage containers in background |
| `npm run docker:down` | Stops all Docker infrastructure containers |
| `npm run docker:status` | Shows container status and health check state |
| `npm run docker:logs` | Streams logs from all Docker services |
| `npm run db:migrate` | Runs pending plain SQL migrations on PostgreSQL |
| `npm run db:seed` | Populates database with repeatable local development seed data |
| `npm run dev` | Starts all workspace development servers |
| `npm run dev:api` | Starts the Express backend API (`apps/api`) |
| `npm run dev:web` | Starts the Vite React frontend (`apps/web`) |
| `npm run build` | Builds shared package, API, and web in dependency order |
| `npm run typecheck` | Runs strict TypeScript type-checking across all packages |
| `npm run lint` | Runs ESLint across all TypeScript packages |
| `npm run format:check` | Verifies code formatting with Prettier |
| `npm run format` | Auto-formats code with Prettier |

---

## Troubleshooting & FAQ

- **Port in Use (5432 or 6379):**
  If local services are already running natively, stop them or change `DB_PORT` / `REDIS_PORT` in `.env` and `docker-compose.yml`.
- **Database Connection Error:**
  Ensure Docker containers are healthy (`npm run docker:status`). PostgreSQL initialization may take ~5 seconds on first start.
- **PowerShell Script Policy:**
  On Windows, if PowerShell reports `running scripts is disabled`, run commands via `cmd /c npm ...` or execute:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- **Resetting Database & Volumes:**
  To completely reset local development database and storage:
  ```bash
  docker compose down -v
  npm run docker:up
  npm run db:migrate
  npm run db:seed
  ```

---

*Detailed local setup guide: [docs/development/local-setup.md](docs/development/local-setup.md).*
