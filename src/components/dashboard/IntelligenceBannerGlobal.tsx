"use client";

/**
 * Global intelligence banner — self-contained client component for the dashboard layout.
 * Wraps useIntelligenceContext + IntelligenceBanner so the server layout
 * can render it without passing props.
 */

import { useIntelligenceContext } from "@/hooks/useIntelligenceContext";
import { IntelligenceBanner } from "./IntelligenceBanner";

export function IntelligenceBannerGlobal() {
  const intel = useIntelligenceContext();
  return (
    <IntelligenceBanner
      risk={intel.risk}
      nba={intel.nba}
      score={intel.score}
      loading={intel.loading}
    />
  );
}
