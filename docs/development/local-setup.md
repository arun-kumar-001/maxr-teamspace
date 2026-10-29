# Local Development Environment Guide (TL-02)

This guide enables any developer to clone the repository and run MAXR Teamspace locally in under **30 minutes**.

---

## 1. Prerequisites

Before starting, ensure the following tools are installed on your machine:
- **Node.js**: v18.0.0 or higher (`node -v` >= 18)
- **Package Manager**: `npm` (v9+) or `pnpm` (v9+)
- **Docker**: Docker Desktop / Engine running with Docker Compose v2+ (`docker compose version`)
- **Git**: Installed and configured

---

## 2. Infrastructure Services (Docker Compose)

The local development infrastructure runs isolated in Docker containers:

| Service | Container Name | Host Port | Internal Port | Purpose | Health Check |
|---|---|---|---|---|---|
| **PostgreSQL 16** | `maxr-postgres` | `5432` | `5432` | Primary database (`maxr_teamspace`) | `pg_isready -U postgres -d maxr_teamspace` |
| **Redis 7** | `maxr-redis` | `6379` | `6379` | Session cache & rate-limiting | `redis-cli ping` |
| **Mailpit** | `maxr-mailpit` | `1025` (SMTP), `8025` (Web UI) | `1025`, `8025` | Local transactional email testing & inbox | `/mailpit readyz` (built in) |
| **S3 Storage Mock** | `maxr-storage` | `9090` | `9090` | S3-compatible private object storage (Adobe S3Mock) | none; open http://localhost:9090/ |

Data persistence is guaranteed across container restarts using named Docker volumes: `postgres_data`, `redis_data`, `mailpit_data`, and `storage_data`.

---

## 3. Step-by-Step Setup

### Step 1: Configure Environment
Copy the safe template `.env.example` to `.env`:
```bash
cp .env.example .env
```
*Note: `.env.example` contains safe local defaults (`postgres`/`postgres`; the S3 mock does not check credentials). Never commit real secrets or production credentials.*

### Step 2: Install Workspace Dependencies
```bash
npm install
```

### Step 3: Start Docker Infrastructure
```bash
npm run docker:up
```
Verify that all services are healthy:
```bash
npm run docker:status
```

### Step 4: Run Database Migrations
Run the versioned plain SQL migrations:
```bash
npm run db:migrate
```
*This creates the `schema_migrations` tracking table and applies all pending SQL scripts in `apps/api/src/db/migrations/`.*

### Step 5: Seed Development Database
Populate the database with safe, repeatable local development data:
```bash
npm run db:seed
```
*Safety Note: The seeder contains a strict failsafe check that prevents execution if `NODE_ENV === 'production'`.*

### Step 6: Start Application Servers
Start both backend API and frontend web application:
```bash
# Terminal 1: Backend Express API (port 4000)
npm run dev:api

# Terminal 2: Frontend React SPA (port 3000)
npm run dev:web
```

---

## 4. Verification & Health Checks

Once running, verify that the environment is healthy:

### 1. API Health Check
```bash
curl http://localhost:4000/api/health
```
or versioned:
```bash
curl http://localhost:4000/api/v1/health
```

**Expected JSON Response (HTTP 200):**
```json
{
  "status": "healthy",
  "service": "maxr-api",
  "version": "0.1.0",
  "environment": "development",
  "uptimeSeconds": 45,
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

### 2. Local Service Dashboards
- **Frontend Web App:** [http://localhost:3000](http://localhost:3000)
- **Backend API Health:** [http://localhost:4000/api/health](http://localhost:4000/api/health)
- **Mailpit Email Web UI:** [http://localhost:8025](http://localhost:8025) *(view emails sent by notifications)*
- **S3 Storage Mock Endpoint:** [http://localhost:9090](http://localhost:9090) *(S3 API endpoint)*

---

## 5. Development Workflow Commands

| Action | Command |
|---|---|
| Start all Docker services | `npm run docker:up` |
| Stop all Docker services | `npm run docker:down` |
| View Docker service logs | `npm run docker:logs` |
| Check Docker service status | `npm run docker:status` |
| Run plain SQL migrations | `npm run db:migrate` |
| Run development seed | `npm run db:seed` |
| Run all quality checks | `npm run typecheck && npm run format:check && npm run build` |

---

## 6. Troubleshooting

1. **Port Conflicts (e.g. 5432 or 6379 already in use):**
   - If you have a local PostgreSQL or Redis server running natively on your host machine, stop them (`sudo service postgresql stop` or Windows Service manager) or change `DB_PORT` / `REDIS_PORT` in your `.env` and `docker-compose.yml`.
2. **Database Connection Refused:**
   - Wait 5-10 seconds for PostgreSQL container to complete initialization. Run `npm run docker:status` to ensure status is `(healthy)`.
3. **S3 Storage Mock Access:**
   - The local S3 mock accepts standard AWS S3 requests on port 9090 with initial bucket `maxr-private-storage`.
4. **PowerShell Script Policy:**
   - On Windows, if `npm` scripts report unauthorized script execution, run via `cmd /c npm ...` or set execution policy:
     ```powershell
     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
     ```

