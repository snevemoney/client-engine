# Testing in the side-panel browser

Quick reference for testing the app in the Cursor side-panel browser (or similar embedded context).

---

## What we know

- **App routes are good:** All dashboard and public pages load when the session is valid.
- **Local side-panel testing is reliable** if you’re already logged in (e.g. you logged in earlier in the same session, or dev redirects you to the dashboard).
- **Production side-panel** may fail on `/login` or protected routes: you can see `chrome-error://chromewebdata/`. This is usually **auth/redirect/cookie behavior** in the embedded context, not broken pages:
  - Auth redirects bounce across routes
  - Cookies/session aren’t accepted the same way in the side panel
  - Login or popup flows can be restricted in embedded browsers

So: **the app and dashboard navigation work**; the weak point is **production login inside the side panel**, not the app itself.

---

## Production validation (when side-panel login fails)

1. **Log in in the main browser first** (e.g. Chrome or Safari at https://evenslouis.ca/login).
2. **Then** open dashboard routes in the side panel (or in the same main browser).

That way you confirm prod pages and auth without relying on the embedded context for the login step.

---

## Exact test routes (in order)

Always test these core routes in this order so testing stays consistent:

1. `/dashboard/command` — Command Center  
2. `/dashboard/leads` — Leads  
3. `/dashboard/proposals` — Proposals  
4. `/dashboard/metrics` — Metrics  
5. `/dashboard/chat` — Chat  
6. `/dashboard/settings` — Settings  

Then as needed: `/dashboard/learning`, `/dashboard/proof`, `/dashboard/checklist`, `/dashboard/deploys`, `/dashboard/conversion`, `/dashboard/knowledge`, `/work`.

---

## Pass / Fail criteria

**Pass if:**

- Route loads (no blank page)
- No `chrome-error://chromewebdata/`
- No console errors
- Data cards / content render (not blank)
- Auth-protected routes work after login

**Fail if:**

- Redirect loop
- Blank page
- 500 response
- Console errors
- Auth route opens an error page in a **normal** browser tab (that indicates an app/auth bug, not just side-panel limitation)

---

## Mini checklist (fast, repeatable)

Use this when you want to sanity-check after changes (especially when tired after work):

- [ ] **Main browser (prod):** Open https://evenslouis.ca, log in, hit key dashboard routes. Confirm no error pages.
- [ ] **Side panel (localhost):** Start dev (`npm run dev`), open http://localhost:3000 (log in if needed), then visit the exact test routes above.
- [ ] **Key routes:** Command Center, Leads, Proposals, and at least one of Proof/Checklist/Deploys load without errors.
- [ ] **Console:** No console errors on the pages you opened.
- [ ] **Auth-protected routes:** After logging in (main browser or local), protected routes load; without login they redirect to login as expected.

---

## Post-deploy smoke test

After every deploy:

1. **One-command smoke test:**  
   `./scripts/smoke-test.sh`  
   (or `./scripts/smoke-test.sh https://evenslouis.ca`)  
   Checks: homepage, login, dashboard, `/api/health`, `/api/ops/command`, and optionally SSL. Exits 0 if all pass.

2. **Manual:** `curl -s https://evenslouis.ca/api/health` — expect 200 and `"ok": true`.

3. Open `/dashboard/command` in a **normal browser tab** (not side panel) and confirm it loads after login.

That ties testing to production ops.

---

## Known limitations

- **Prod side-panel login** may fail due to embedded auth/cookie restrictions. Don’t treat that alone as a production bug.
- **Validate auth in a normal browser tab first** (log in there, then use side panel for other routes if you like).

---

## Optional fix path (later)

If you want **side-panel prod login** to work better in the embedded browser, you can later harden auth by checking:

- Cookie **SameSite** / **Secure** settings
- Redirect **callback URL** behavior (e.g. NEXTAUTH_URL and allowed redirects)
- **Middleware** redirect loops
- Whether the auth provider blocks embedded/iframe contexts

For now, **local dashboard + main-browser prod** is enough to move forward confidently.
