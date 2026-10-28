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
│   │   │   ├── middleware/     # Request ID, error envelope, security middleware
│   │   │   ├── modules/        # Layered business modules (routes -> service -> repository)
│   │   │   │   └── _template/  # Reference implementation for new modules
│   │   │   ├── app.ts          # Express application initialization
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
│   ├── project-planning/       # Work breakdown, gap analysis & roadmap
│   └── requirements/           # Product baseline & role permission matrix
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
| **Cache & Sessions** | Redis (temporary caching and rate-limiting) |
| **File Storage** | Encrypted private storage with signed download links |

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ LTS recommended)
- **Package Manager**: `npm` (v9+) or `pnpm` (v9+)
- **Git**: Installed and configured

---

## Quick Start Setup

### 1. Clone & Configure Environment
```bash
git clone https://github.com/arun-kumar-001/maxr-teamspace.git
cd maxr-teamspace

# Copy safe environment template
cp .env.example .env
```

### 2. Install Dependencies
```bash
# Using npm
npm install

# Or using pnpm
pnpm install
```

### 3. Build Shared Packages
```bash
npm run build:shared
```

### 4. Run Development Servers
```bash
# Start backend API (runs on http://localhost:4000)
npm run dev:api

# In a separate terminal, start frontend web app (runs on http://localhost:3000)
npm run dev:web
```

Verify backend health at: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health).

---

## Available Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Starts all workspace development servers |
| `npm run dev:api` | Starts the Express backend API (`apps/api`) |
| `npm run dev:web` | Starts the Vite React frontend (`apps/web`) |
| `npm run build` | Builds shared package, API, and web in dependency order |
| `npm run build:shared` | Compiles `@maxr/shared` TypeScript declarations |
| `npm run build:api` | Compiles `@maxr/api` to `dist/` |
| `npm run build:web` | Compiles `@maxr/web` production bundle to `dist/` |
| `npm run typecheck` | Runs strict TypeScript type-checking across all packages |
| `npm run lint` | Runs ESLint across all TypeScript packages |
| `npm run format:check` | Verifies code formatting with Prettier |
| `npm run format` | Auto-formats code with Prettier |
| `npm run test` | Executes test suites across workspaces |

---

## Architecture Decision Records (ADRs)

Key architectural decisions are recorded in `docs/architecture/decisions/`:
- **[D-02 Modular Monolith & Workspaces](docs/architecture/decisions/D-02-monorepo-and-package-manager.md)**: Workspace monorepo layout and strict module boundaries.
- **[D-03 Backend & Frontend Framework](docs/architecture/decisions/D-03-backend-and-frontend-framework.md)**: Express.js layered architecture and React SPA.
- **[D-04 Database & Plain SQL Migrations](docs/architecture/decisions/D-04-database-and-migrations.md)**: PostgreSQL 16 and plain SQL migrations (No Prisma).
- **[D-05 Authentication & Sessions](docs/architecture/decisions/D-05-authentication-and-sessions.md)**: Stateful revocable sessions and instant deactivation.
- **[D-09 CI/CD & Quality Gates](docs/architecture/decisions/D-09-cicd-and-quality-gates.md)**: GitHub Actions and PR validation gates.

---

## Module Development Guide

Every new backend module must follow the reference template in `apps/api/src/modules/_template/`:
- **Routes (`*.routes.ts`)**: HTTP endpoints, middleware registration, schema validation.
- **Controller (`*.controller.ts`)**: Request/response parameters, status codes. No SQL.
- **Service (`*.service.ts`)**: Domain logic, transactions, state machines. No HTTP types.
- **Repository (`*.repository.ts`)**: Parameterized SQL queries and scope filters.

Frontend features must follow `apps/web/src/features/_template/`:
- Mobile-first responsive layouts tested across phone (360px), tablet (768px), desktop (1280px), and ultrawide (2560px+).
- Always provide 5 UI states: **loading, empty, error, access-denied, and validation**.

---

## Troubleshooting

- **PowerShell Script Execution Policy (`npm.ps1`)**:
  If PowerShell reports `running scripts is disabled`, run commands via `cmd /c npm ...` or enable script execution:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- **Port Conflicts**:
  The API uses port `4000` and the web app uses `3000`. Adjust `PORT` and `CORS_ORIGIN` in `.env` if necessary.
- **Shared Package Resolution**:
  If import errors occur on `@maxr/shared`, ensure `npm run build:shared` has been run so declaration files exist in `packages/shared/dist`.
