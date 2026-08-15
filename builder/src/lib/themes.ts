/**
 * Theme system — uses brandColors from enrichment, NEVER defaults to green.
 * Maps 4 hex colors: primary, heroFrom, heroTo, accent.
 */

export type ThemeColors = {
  primary: string;
  primaryHover: string;
  heroFrom: string;
  heroTo: string;
  accent: string;
};

/** Non-green fallbacks when brandColors is empty — vary by industry */
const INDUSTRY_FALLBACKS: Record<string, ThemeColors> = {
  health_coaching: { primary: "#0d9488", primaryHover: "#0f766e", heroFrom: "#134e4a", heroTo: "#2dd4bf", accent: "#5eead4" },
  fitness: { primary: "#dc2626", primaryHover: "#b91c1c", heroFrom: "#7f1d1d", heroTo: "#f87171", accent: "#fca5a5" },
  life_coaching: { primary: "#7c3aed", primaryHover: "#6d28d9", heroFrom: "#4c1d95", heroTo: "#a78bfa", accent: "#c4b5fd" },
  business_coaching: { primary: "#2563eb", primaryHover: "#1d4ed8", heroFrom: "#1e3a8a", heroTo: "#60a5fa", accent: "#93c5fd" },
  consulting: { primary: "#1e40af", primaryHover: "#1e3a8a", heroFrom: "#172554", heroTo: "#3b82f6", accent: "#93c5fd" },
  agency: { primary: "#d97706", primaryHover: "#b45309", heroFrom: "#78350f", heroTo: "#fbbf24", accent: "#fde68a" },
  freelance: { primary: "#0891b2", primaryHover: "#0e7490", heroFrom: "#155e75", heroTo: "#22d3ee", accent: "#67e8f9" },
  custom: { primary: "#6366f1", primaryHover: "#4f46e5", heroFrom: "#312e81", heroTo: "#818cf8", accent: "#a5b4fc" },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1]!, 16), g: parseInt(result[2]!, 16), b: parseInt(result[3]!, 16) }
    : { r: 0, g: 0, b: 0 };
}

function adjustBrightness(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (n: number) => Math.round(Math.min(255, Math.max(0, n)));
  return `#${clamp(r * factor).toString(16).padStart(2, "0")}${clamp(g * factor).toString(16).padStart(2, "0")}${clamp(b * factor).toString(16).padStart(2, "0")}`;
}

/**
 * Build theme from brandColors (4 hex). NEVER use green when brandColors provided.
 * When brandColors is empty, use industry-specific non-green fallback.
 */
export function getTheme(
  industry: string,
  brandColors?: string[] | null
): ThemeColors {
  if (brandColors && brandColors.length >= 4) {
    const [primary, heroFrom, heroTo, accent] = brandColors;
    return {
      primary: primary ?? "#6366f1",
      primaryHover: primary ? adjustBrightness(primary, 0.9) : "#4f46e5",
      heroFrom: heroFrom ?? primary ?? "#312e81",
      heroTo: heroTo ?? accent ?? "#818cf8",
      accent: accent ?? "#a5b4fc",
    };
  }
  return INDUSTRY_FALLBACKS[industry] ?? INDUSTRY_FALLBACKS.custom;
}

/** For CSS injection — returns CSS custom properties */
export function themeToCssVars(theme: ThemeColors): string {
  return `
    --color-primary: ${theme.primary};
    --color-primary-hover: ${theme.primaryHover};
    --color-hero-from: ${theme.heroFrom};
    --color-hero-to: ${theme.heroTo};
    --color-accent: ${theme.accent};
  `.trim();
}
