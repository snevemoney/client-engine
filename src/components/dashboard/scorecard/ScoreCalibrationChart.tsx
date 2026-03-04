import type { ScoreCalibrationPoint } from "@/lib/ops/scoreCalibration";

const W = 500;
const H = 280;
const PAD = { top: 20, right: 20, bottom: 40, left: 50 };

type Props = {
  data: ScoreCalibrationPoint[];
};

export function ScoreCalibrationChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-700 bg-neutral-900/30 p-8 text-center text-sm text-neutral-500">
        No calibration data yet. Record outcomes on paid projects in Deploys.
      </div>
    );
  }

  const scores = data.map((d) => d.score);
  const revenues = data.map((d) => d.actualRevenueCents);
  const minScore = Math.min(0, ...scores);
  const maxScore = Math.max(100, ...scores);
  const minRev = Math.min(0, ...revenues);
  const maxRev = Math.max(...revenues) * 1.1 || 1;
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const x = (score: number) =>
    PAD.left + ((score - minScore) / (maxScore - minScore || 1)) * chartW;
  const y = (cents: number) =>
    PAD.top + chartH - ((cents - minRev) / (maxRev - minRev || 1)) * chartH;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[300px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <text
          x={PAD.left}
          y={PAD.top - 5}
          className="fill-neutral-500 text-[10px]"
        >
          AI score
        </text>
        <text
          x={W - PAD.right}
          y={H - 5}
          className="fill-neutral-500 text-[10px]"
          textAnchor="end"
        >
          Actual revenue ($)
        </text>
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + chartH}
          stroke="currentColor"
          strokeWidth={1}
          className="text-neutral-700"
        />
        <line
          x1={PAD.left}
          y1={PAD.top + chartH}
          x2={PAD.left + chartW}
          y2={PAD.top + chartH}
          stroke="currentColor"
          strokeWidth={1}
          className="text-neutral-700"
        />
        {data.map((d, i) => (
          <circle
            key={`${d.leadId}-${d.projectId}-${i}`}
            cx={x(d.score)}
            cy={y(d.actualRevenueCents)}
            r={5}
            fill="currentColor"
            className="text-emerald-500"
          />
        ))}
      </svg>
    </div>
  );
}
