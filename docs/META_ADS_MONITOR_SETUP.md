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

## Troubleshooting

### Leads not showing

- Lead metrics come from Meta Pixel + CAPI `Lead` events. If you see 0 leads:
  1. Check Events Manager → your data set → Overview for Lead event activity.
  2. Ensure Pixel is on your site and CAPI sends Lead from `src/lib/meta-capi.ts`.
  3. Conversion event must be configured for Lead in Events Manager.
  4. Allow 24–48 hours for attribution; Meta can delay reporting.

### Token invalid or expired

- User tokens typically expire in 1–2 hours. Use a long-lived token (60 days) or System User token.
- Generate a new token in Graph API Explorer or Business Settings → System Users → Generate token.
- Replace `META_ACCESS_TOKEN` in `.env` and restart the app.

### Permission denied

- Error `(#100)` or "permission" usually means `ads_read` is missing.
- In Graph API Explorer, add permission `ads_read` and re-generate the token.
- For System User: assign the ad account to the system user and generate token with `ads_read`.

### Timezone mismatches

- Meta reports in the ad account timezone (set in Ads Manager → Settings).
- The dashboard uses your local time for "Last sync". Date ranges (today, 7d, etc.) are interpreted by Meta’s API in the account timezone.
- If "today" looks off, check your ad account timezone in Ads Manager.

### Rate limit

- Meta limits ~200 calls/hour per user. The dashboard makes multiple calls per refresh.
- Use the 10-minute cache: repeated refreshes within 10 min use cached data.
- Click Refresh with cache bypass sparingly; wait 5–10 min between forced refreshes.

## Lead metrics

Leads come from the Meta Pixel / CAPI `Lead` event. Ensure:

- Pixel installed on your site
- CAPI sends `Lead` events (see `src/lib/meta-capi.ts`)
- Conversion event is configured for Lead in Events Manager

If leads show 0, check Events Manager → your data set → Overview for Lead event activity.
