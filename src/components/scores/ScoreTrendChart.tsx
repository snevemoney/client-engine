/**
 * Phase 3.3: Score trend chart — simple SVG polyline (no external chart lib).
 */
type Point = { score: number; computedAt: string };

const W = 600;
const H = 160;
const PAD = { top: 12, right: 12, bottom: 12, left: 12 };
const BAND_Y = {
  critical: { min: H - PAD.bottom - 40, max: H - PAD.bottom },
  warning: { min: H - PAD.bottom - 80, max: H - PAD.bottom - 40 },
  healthy: { min: PAD.top, max: H - PAD.bottom - 80 },
};

type Props = {
  timeline: Point[];
  rangeLabel: string;
};

export function ScoreTrendChart({ timeline, rangeLabel }: Props) {
  if (timeline.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/30 p-8 text-center text-sm text-neutral-500"
        data-testid="score-trend-chart-empty"
      >
        No data in {rangeLabel}
      </div>
    );
  }

  const scores = timeline.map((p) => p.score);
  const minS = Math.min(0, ...scores);
  const maxS = Math.max(100, ...scores);
  const range = maxS - minS || 1;
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (i / Math.max(1, timeline.length - 1)) * chartW;
  const y = (s: number) => PAD.top + chartH - ((s - minS) / range) * chartH;

  const bandPaths = [
    { band: "healthy", ...BAND_Y.healthy },
    { band: "warning", ...BAND_Y.warning },
    { band: "critical", ...BAND_Y.critical },
  ];

  return (
    <div
      className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 overflow-x-auto"
      data-testid="score-trend-chart"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-neutral-300">Score trend — {rangeLabel}</h2>
        <div className="flex gap-2 text-xs text-neutral-500">
          <span>healthy</span>
          <span>warning</span>
          <span>critical</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[300px]" preserveAspectRatio="xMidYMid meet">
        {bandPaths.map((b) => (
          <rect
            key={b.band}
            x={PAD.left}
            y={b.min}
            width={chartW}
            height={b.max - b.min}
            fill="currentColor"
            className={
              b.band === "healthy"
                ? "text-emerald-500/10"
                : b.band === "warning"
                  ? "text-amber-500/10"
                  : "text-red-500/10"
            }
            aria-hidden
          />
        ))}
        <polyline
          points={timeline.map((p, i) => `${x(i)},${y(p.score)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-emerald-400"
        />
      </svg>
    </div>
  );
}
