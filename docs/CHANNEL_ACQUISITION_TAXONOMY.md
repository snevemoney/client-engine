# Client Acquisition Channel Taxonomy

**Purpose:** Single source of truth for lead source channels in the Client Acquisition Engine. Manual-first; no auto-send.

## Canonical channels

Use these values for `leadSourceChannel` on leads and for Channel ROI / Prospecting Sources:

| Code | Label |
|------|--------|
| `LINKEDIN` | LinkedIn |
| `YOUTUBE` | YouTube |
| `TIKTOK` | TikTok |
| `INSTAGRAM` | Instagram |
| `X` | X (Twitter) |
| `THREADS` | Threads |
| `NETWORKING_EVENT` | Networking Event |
| `REFERRAL` / `REFERRAL_INTRO` | Referral |
| `NEWSLETTER` | Newsletter |
| `OTHER` | Other |

Legacy codes still supported: `EMAIL_OUTREACH`, `DIRECT_MESSAGE`, `WEBSITE_INBOUND`. Prefer the list above for new data.

## Metrics by channel

For each channel we track (manual entry OK):

- **Inquiries** — new leads attributed to channel
- **Qualified leads** — score ≥ threshold
- **Proposals** — proposals sent (proposalSentAt set)
- **Wins** — dealOutcome = won
- **Revenue** — from won deal budget or manual entry

See Command Center → **Channel ROI** and **Prospecting sources** cards.
