# One-command deploy (SSH deploy key)

Git pull was failing on the server because the repo uses HTTPS and GitHub asks for credentials. Fix it once with an SSH deploy key; then deploys are one command.

---

## 1) SSH into the server

```bash
ssh root@69.62.66.78
```

## 2) Switch remote to SSH

```bash
cd /root/client-engine
git remote -v
```

If you see `https://github.com/...`, switch it:

```bash
git remote set-url origin git@github.com:snevemoney/client-engine.git
```

## 3) Create an SSH key on the server (if needed)

```bash
ls -la ~/.ssh
```

If you don’t see `id_ed25519` / `id_ed25519.pub` (or `id_rsa.pub`), generate one:

```bash
ssh-keygen -t ed25519 -C "server-deploy-key" -f ~/.ssh/id_ed25519 -N ""
```

## 4) Add the public key to GitHub Deploy Keys

On the server:

```bash
cat ~/.ssh/id_ed25519.pub
```

Copy the output. In GitHub:

- Repo: **client-engine**
- **Settings → Deploy keys → Add deploy key**
- Paste the key
- Name: e.g. `server-prod-deploy`
- **Allow write access** OFF (read-only is enough for pull)

## 5) Pin the SSH key (avoids weird key issues)

On the server:

```bash
cat > ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
```

Git will always use this key for GitHub.

## 6) Trust GitHub host key (first-time only)

On the server:

```bash
ssh -T git@github.com
```

- “Are you sure you want to continue connecting (yes/no)?” → **yes**
- “successfully authenticated…” or “GitHub does not provide shell access” → both are fine

## 7) Pull and deploy

```bash
cd /root/client-engine
git pull origin main
bash deploy.sh
```

## 8) Health check (verify)

```bash
curl -s https://evenslouis.ca/api/health
```

Expect `"ok": true` in the JSON.

---

## One-command deploy (after setup)

On the **server**, create the deploy script (fails loudly, prints each step):

```bash
cat > /root/deploy-client-engine.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "==> Deploy started: $(date)"
cd /root/client-engine

echo "==> Pulling latest code..."
git pull origin main

echo "==> Running deploy script..."
bash deploy.sh

echo "==> Health check..."
curl -fsS https://evenslouis.ca/api/health

echo
echo "==> Deploy complete ✅"
EOF

chmod +x /root/deploy-client-engine.sh
```

`-f` on curl makes it fail if the site returns an error page.

Then from your **Mac** (or any machine with SSH to the server):

```bash
ssh root@69.62.66.78 '/root/deploy-client-engine.sh'
```

---

## Rollback (if a deploy breaks)

On the **server**:

```bash
cd /root/client-engine
git log --oneline -5
git reset --hard HEAD~1
bash deploy.sh
```

Optional: create a rollback script on the server:

```bash
cat > /root/rollback-client-engine.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /root/client-engine
echo "==> Last 5 commits:"
git log --oneline -5
echo "==> Rolling back one commit..."
git reset --hard HEAD~1
echo "==> Redeploying..."
bash deploy.sh
curl -fsS https://evenslouis.ca/api/health
echo "==> Rollback complete ✅"
EOF
chmod +x /root/rollback-client-engine.sh
```

---

## If SSH key still fails

On the server, run:

```bash
GIT_SSH_COMMAND="ssh -vvv" git ls-remote git@github.com:snevemoney/client-engine.git
```

The output shows whether the issue is wrong key, key not added to GitHub, repo access, or host key. Share the output to debug.

---

## Option B: rsync deploy (no Git on server)

If you prefer not to use Git on the server, you can rsync the repo from your Mac and run deploy. See a separate doc or ask for exact `rsync` + `ssh` commands.

---

## Later: non-root deploy user

Current flow (root) is fine while moving fast. Long-term, a dedicated deploy user for Git pulls and app deploys is cleaner and safer. You can harden later.

---

## Optional: auto-deploy on push

For true autopilot (e.g. push to main → deploy while you're at your 9–5), use GitHub Actions to SSH into the server and run `/root/deploy-client-engine.sh`. Keeps the server simple; deploy still runs there.

---

## Later: non-root deploy user

Current flow (root) is fine while moving fast. Long-term, a dedicated deploy user for Git pulls and app deploys is cleaner and safer. You can harden later.

---

## Optional: auto-deploy on push

For true autopilot (e.g. push to main → deploy while you're at your 9–5), use GitHub Actions to SSH into the server and run `/root/deploy-client-engine.sh`. Keeps the server simple; deploy still runs there.
