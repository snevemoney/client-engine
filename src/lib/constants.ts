/**
 * Application-wide constants.
 * Use these instead of magic numbers/strings scattered across the codebase.
 */

/** Service port numbers */
export const PORTS = {
  /** Next.js app server (default dev/local) */
  APP: 3000,
  /** OpenClaw gateway */
  GATEWAY: 18789,
  /** Qdrant vector store */
  QDRANT: 6333,
  /** BGE-M3 embedder service */
  EMBEDDER: 8000,
  /** Builder service */
  BUILDER: 3001,
} as const

/** Telegram group and topic constants */
export const TELEGRAM = {
  /** Main Outer Heaven Telegram group */
  GROUP_ID: '-1003718712318',
  TOPICS: {
    MAIN: 1,
    OCELOT: 7,
    SIGINT: 8,
    AUTORESEARCH: 9,
    FORGE: 10,
    ALERTS: 13,
    LEDGER: 162,
    BUSINESS: 417,
    SCOUT: 418,
    RADAR: 419,
    VOICE: 420,
    DESIGNER: 421,
    CREATOR: 423,
    LIVE_ACTIVITY: 424,
  },
} as const

/** Local app base URL fallback (used when NEXTAUTH_URL is not set) */
export const LOCAL_APP_URL = `http://localhost:${PORTS.APP}` as const
