/**
 * Sales Driver: static message angle suggestions by driver type.
 * V1: no AI, static templates only.
 */

export const DRIVER_TYPES = [
  "survival",
  "status",
  "freedom",
  "cause",
  "competition",
  "enemy",
  "unknown",
] as const;

export type DriverType = (typeof DRIVER_TYPES)[number];

const ANGLE_MAP: Record<string, string> = {
  survival: "Focus on stopping lead leaks / immediate cash impact.",
  status: "Focus on credibility, client experience, and polish.",
  freedom: "Focus on saving time and removing manual follow-up.",
  cause: "Focus on mission/business impact.",
  competition: "Focus on gaining an edge over slower competitors.",
  enemy: "Focus on the risk/problem they want to eliminate.",
  unknown: "Clarify their driver before pitching.",
};

export function getMessageAngle(driverType: string | null | undefined): string {
  if (!driverType) return ANGLE_MAP.unknown;
  const key = driverType.toLowerCase();
  return ANGLE_MAP[key] ?? ANGLE_MAP.unknown;
}
