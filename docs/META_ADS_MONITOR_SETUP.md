# Meta Ads Monitor — Setup

Read-only dashboard to see ad performance without opening Ads Manager. Requires Meta Marketing API access.

## Prerequisites

1. **Meta App** — Create or use an existing app at [developers.facebook.com](https://developers.facebook.com/apps/)
2. **Ad account** — You must have an ad account with campaigns
3. **Permissions** — The app needs `ads_read` (read ads and insights)

## Required permissions

- `ads_read` — Required to read campaigns, ad sets, ads, and insights

## Generate access token

### Option A: Graph API Explorer (quick dev/test)

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app
3. Add permission `ads_read`
4. Generate token (User Token or System User token for production)
5. **System User token** (recommended for server):
   - Business Settings → Users → System Users → Create
   - Assign ad account to system user
   - Generate token with `ads_read`

### Option B: Long-lived token

1. Get short-lived token from Graph API Explorer
2. Exchange for long-lived:
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token?
     grant_type=fb_exchange_token&
     client_id=APP_ID&
     client_secret=APP_SECRET&
     fb_exchange_token=SHORT_LIVED_TOKEN
   ```

Tokens expire. For production, use a System User token or implement token refresh.

## Find Ad Account ID

- In Ads Manager: Settings → Business settings → Accounts → Ad accounts
- Format: `act_1234567890` (numeric part only also works; we add `act_` if missing)

## Environment variables

Add to `.env` (or production server `.env`):

```bash
# Meta Ads Monitor (read-only)
META_ACCESS_TOKEN=your-long-lived-or-system-user-token
META_AD_ACCOUNT_ID=act_1234567890
# Optional: API version (default v21.0)
# META_API_VERSION=v21.0
```

**Security:** Never expose `META_ACCESS_TOKEN` to the client. It is used only in API routes.

## Test connection

1. Start the app: `npm run dev`
2. Log in
3. Go to **Dashboard → Meta Ads** (or `/dashboard/meta-ads`)
4. Select a date range and click Refresh

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `META_ACCESS_TOKEN not configured` | Env var not set | Add to `.env` and restart |
| `Invalid or expired token` | Token expired or wrong | Generate new token |
| `Unsupported get request` | Wrong ad account ID or no access | Check account ID, ensure token has `ads_read` |
| Rate limit | Too many API calls | Reduce refresh frequency; Meta limits ~200 calls/hour per user |
| `(#100) No permission` | Missing `ads_read` | Re-generate token with `ads_read` |

## Lead metrics

Leads come from the Meta Pixel / CAPI `Lead` event. Ensure:

- Pixel installed on your site
- CAPI sends `Lead` events (see `src/lib/meta-capi.ts`)
- Conversion event is configured for Lead in Events Manager

If leads show 0, check Events Manager → your data set → Overview for Lead event activity.
