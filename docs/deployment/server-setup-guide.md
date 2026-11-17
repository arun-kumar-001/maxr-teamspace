# Server / Instance Box Setup Guide (MAXR Teamspace)

This guide provides the complete setup to deploy and run **MAXR Teamspace** on a cloud instance box (Ubuntu 22.04 / 24.04 LTS VPS, AWS EC2, DigitalOcean, Hetzner, etc.).

---

## 1. Server Prerequisites

On your fresh Linux instance box, install **Git**, **Docker**, and **Docker Compose**:

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install essential tools
sudo apt install -y curl wget git ufw

# 3. Install Docker Engine and Compose v2
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 4. Add your user to the docker group (optional, avoids sudo for docker)
sudo usermod -aG docker $USER
newgrp docker

# 5. Verify docker installation
docker --version
docker compose version
```

### Install Node.js 22 LTS (for native/PM2 run):
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v   # Should be v22.x
npm -v
```

---

## 2. Clone the Repository

```bash
cd ~
git clone https://github.com/arun-kumar-001/maxr-teamspace.git
cd maxr-teamspace
```

---

## 3. Deployment Method A: Full Docker Compose Production Stack (Recommended)

This method runs everything (PostgreSQL, Redis, API, and Nginx-served Frontend) inside isolated Docker containers.

### Step 1: Prepare Environment File
```bash
cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
```

Generate secure random secrets and update `deploy/.env.production`:
```bash
# Generate secrets
openssl rand -base64 32
```
Edit `deploy/.env.production`:
```ini
DB_USER=maxr
DB_NAME=maxr_teamspace
DB_PASSWORD=<GENERATE_SECURE_PASSWORD>
REDIS_PASSWORD=<GENERATE_SECURE_PASSWORD>

SESSION_SECRET=<GENERATE_32_CHAR_SECRET>
STORAGE_SIGNING_SECRET=<GENERATE_32_CHAR_SECRET>
CORS_ORIGIN=http://YOUR_SERVER_IP # or https://yourdomain.com
LOG_LEVEL=info

HTTP_PORT=80
HTTPS_PORT=443
TLS_CERT_DIR=/etc/maxr/certs
STORAGE_DRIVER=local
```

### Step 2: Start Database & Redis, Run Migrations & Seed
```bash
# 1. Start Postgres and Redis containers
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d postgres redis

# 2. Run schema migrations
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production run --rm migrate

# 3. Start the entire application stack
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build
```

---

## 4. Deployment Method B: Quick Server Mode (PM2 + Docker DB)

If you are running the instance box without an SSL certificate and want immediate access via `http://<SERVER_IP>:3000`:

### Step 1: Start Database, Redis & Storage via Docker
```bash
# Start backend infrastructure
docker compose up -d postgres redis mailpit storage
```

### Step 2: Install Dependencies & Build
```bash
npm ci
npm run build
```

### Step 3: Run Database Migration & Seed
```bash
npm run db:migrate
npm run db:seed
```

### Step 4: Run with PM2
Create `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: 'maxr-api',
      cwd: './apps/api',
      script: 'dist/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        HOST: '0.0.0.0',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/maxr_teamspace',
        REDIS_URL: 'redis://localhost:6379',
        CORS_ORIGIN: 'http://localhost:3000',
        SESSION_SECRET: 'production-secret-min-32-chars-long-secure-key-1234',
        STORAGE_DRIVER: 'local',
      },
    },
    {
      name: 'maxr-web',
      cwd: './apps/web',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

Start both services:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 5. Firewall Configuration (UFW)

Open only necessary ports:
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Web (if accessing directly)
sudo ufw enable
sudo ufw status
```

---

## 6. Verification & Health Check

From your local machine or terminal:
```bash
# Health check API
curl http://YOUR_SERVER_IP:4000/api/v1/health

# Web frontend check
curl -I http://YOUR_SERVER_IP:3000
```

### Default Login Accounts:
- **Admin**: `admin@maxr.internal` / `Password123!`
- **HR Manager**: `hr@maxr.internal` / `Password123!`
- **Team Lead**: `teamlead@maxr.internal` / `Password123!`
- **Staff**: `staff@maxr.internal` / `Password123!`
