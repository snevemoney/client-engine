# Builder scaffold (Docker / E2E only)

**DO NOT use this for local development.** This scaffold has a different schema and DB than the real site-builder. Running it on port 3001 will create sites that don't exist in the real builder — causing "Failed to load site data" when you switch back.

**Use the same builder consistently:** Always run the real site-builder for local dev:

```bash
cd /Users/evenslouis/site-builder && npm run dev
```

Then in Client Engine `.env`:
```
BUILDER_API_URL=http://localhost:3001
BUILDER_API_KEY=dev-key
```

This `builder/` directory is used by Docker Compose for production. For local delivery/builder features, use site-builder only.
