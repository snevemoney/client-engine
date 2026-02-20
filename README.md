# Client Engine

Private autopilot business system running on your VPS.

## Quick start (VPS)

```bash
# Clone and configure
git clone <repo-url> /root/client-engine
cd /root/client-engine
cp .env.example .env
# Edit .env with real values

# Deploy
bash deploy.sh
```

## Operations

```bash
bash deploy.sh          # Pull, build, migrate, restart
bash backup.sh          # Backup Postgres to ./backups/
bash logs.sh            # Tail app logs
bash logs.sh worker     # Tail worker logs
bash logs.sh postgres   # Tail DB logs
```

## URLs

- **https://evenslouis.ca** — Public site
- **https://evenslouis.ca/dashboard** — Private dashboard (login required)
- **https://evenslouis.pro** — Redirects to dashboard

## Local development

```bash
npm install
cp .env.example .env    # Configure DATABASE_URL for local Postgres
npx prisma migrate dev
npx prisma db seed
npm run dev
```

## Deploy from local machine

```bash
ssh root@69.62.66.78 "cd /root/client-engine && bash deploy.sh"
```
