/**
 * Client Acquisition Engine: canonical channel list and labels.
 * See docs/CHANNEL_ACQUISITION_TAXONOMY.md and docs/CHANNEL_ROLE_MAP.md.
 */

export const ACQUISITION_CHANNELS = [
  "LINKEDIN",
  "YOUTUBE",
  "TIKTOK",
  "INSTAGRAM",
  "X",
  "THREADS",
  "NETWORKING_EVENT",
  "REFERRAL",
  "REFERRAL_INTRO",
  "NEWSLETTER",
  "OTHER",
  // Legacy (still supported)
  "EMAIL_OUTREACH",
  "DIRECT_MESSAGE",
  "WEBSITE_INBOUND",
  "TWITTER",
] as const;

export type AcquisitionChannelCode = (typeof ACQUISITION_CHANNELS)[number];

export const CHANNEL_LABELS: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  X: "X",
  TWITTER: "X",
  THREADS: "Threads",
  NETWORKING_EVENT: "Networking Event",
  REFERRAL: "Referral",
  REFERRAL_INTRO: "Referral",
  NEWSLETTER: "Newsletter",
  EMAIL_OUTREACH: "Email outreach",
  DIRECT_MESSAGE: "DM",
  WEBSITE_INBOUND: "Inbound/site",
  OTHER: "Other",
};
