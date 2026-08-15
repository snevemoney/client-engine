/**
 * Curated fallback palettes when enrichment fails — professional, sellable looks.
 * Each palette: [primary, heroFrom, heroTo, accent] for getTheme().
 */

import type { BuilderIndustryPreset } from "./client";

/** Curated palettes per industry — [primary, heroFrom, heroTo, accent] */
const CURATED_PALETTES: Record<BuilderIndustryPreset, string[][]> = {
  health_coaching: [
    ["#6b8f71", "#2d3b2d", "#1a2e1a", "#4a7a4f"], // sage
    ["#5a7c59", "#243824", "#1a2e1a", "#3d5c3f"], // forest
    ["#7d9a7a", "#2d3b2d", "#1e2e1e", "#5a7c59"], // soft sage
  ],
  life_coaching: [
    ["#7c3aed", "#3b0764", "#1e1b4b", "#8b5cf6"], // violet
    ["#6b8f71", "#2d3b2d", "#1a2e1a", "#4a7a4f"], // sage
    ["#6366f1", "#312e81", "#1e1b4b", "#818cf8"],  // indigo
  ],
  business_coaching: [
    ["#3b82f6", "#1e293b", "#0f172a", "#2563eb"],  // navy blue
    ["#6366f1", "#312e81", "#1e1b4b", "#4f46e5"], // indigo
    ["#0ea5e9", "#0c4a6e", "#082f49", "#0284c7"],  // sky
  ],
  consulting: [
    ["#3b82f6", "#1e293b", "#0f172a", "#2563eb"],  // navy
    ["#64748b", "#1e293b", "#0f172a", "#475569"],  // slate
    ["#0ea5e9", "#0c4a6e", "#082f49", "#0284c7"],  // sky
  ],
  fitness: [
    ["#ef4444", "#7f1d1d", "#1c1917", "#dc2626"],  // red
    ["#ea580c", "#7c2d12", "#1c1917", "#c2410c"],  // orange
    ["#dc2626", "#991b1b", "#1f2937", "#b91c1c"],  // bold red
  ],
  freelance: [
    ["#8b5cf6", "#3b0764", "#1e1b4b", "#7c3aed"],  // purple
    ["#6366f1", "#312e81", "#1e1b4b", "#4f46e5"],  // indigo
    ["#a855f7", "#581c87", "#3b0764", "#9333ea"],  // violet
  ],
  agency: [
    ["#f97316", "#1c1917", "#0c0a09", "#ea580c"],   // orange
    ["#e11d48", "#881337", "#1c1917", "#be123c"],  // rose
    ["#0ea5e9", "#0c4a6e", "#082f49", "#0284c7"],  // sky
  ],
  custom: [
    ["#10b981", "#064e3b", "#0f172a", "#059669"],   // emerald
    ["#6b8f71", "#2d3b2d", "#1a2e1a", "#4a7a4f"],  // sage
    ["#3b82f6", "#1e293b", "#0f172a", "#2563eb"],  // navy
  ],
};

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Return a curated 4-color palette when brandColors is undefined.
 * Picks from industry-appropriate palettes so every site looks professional.
 * @param variation — When provided (e.g. Date.now() on regenerate), each call gets a different palette.
 */
export function getFallbackBrandColors(
  clientName: string,
  projectId: string,
  industry: BuilderIndustryPreset,
  variation?: string
): string[] {
  const palettes = CURATED_PALETTES[industry] ?? CURATED_PALETTES.custom;
  const seed = simpleHash(clientName + projectId + (variation ?? ""));
  const index = seed % palettes.length;
  return [...palettes[index]!];
}
