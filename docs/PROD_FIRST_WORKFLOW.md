# Prod-First Operator Workflow

Deploy from your Mac. One command. No manual SSH.

---

## Deploy (run from your Mac)

```bash
./scripts/deploy-remote.sh       # Fast: pull + build + restart (no DB sync)
./scripts/deploy-remote.sh --full  # Full: pull + DB sync (when Prisma changed)
./scripts/sync-and-deploy.sh     # No deploy key? Push + rsync + deploy
```

---

## Commands

| Command | What it does |
|--------|--------------|
| `./scripts/deploy-remote.sh` | Deploy to prod. Fast path, no DB sync. |
| `./scripts/deploy-remote.sh --full` | Full deploy with DB sync. |
| `./scripts/sync-and-deploy.sh` | Push to main, rsync to server, deploy. |
| `npm run ops:health` | Check prod health. |

---

## NPM

```bash
npm run deploy        # Same as deploy-remote.sh
npm run deploy:full   # Full deploy with DB sync
npm run ops:health    # Check prod
```

---

## Verify health

```bash
npm run ops:health
# or: curl -s https://evenslouis.ca/api/health
```
- **Expected:** `{"ok":true,"checks":{...}}` with status 200

---

## If deploy fails

Check the script output. Common fixes: commit + push first, or run `./scripts/sync-and-deploy.sh` if git pull fails.
