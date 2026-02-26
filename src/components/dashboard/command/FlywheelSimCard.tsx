"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, CheckCircle, XCircle, Loader2 } from "lucide-react";

type StageResult = { stage: string; status: string; detail: string };
type SimResult = {
  success: boolean;
  leadId?: string;
  deliveryProjectId?: string;
  stages: StageResult[];
  error?: string;
};

export function FlywheelSimCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  async function runSimulation() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/flywheel/simulate", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        stages: [],
        error: err instanceof Error ? err.message : "Failed to run simulation",
      });
    }
    setRunning(false);
  }

  return (
    <div className="rounded-lg border border-neutral-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Flywheel simulation
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            One-click: creates a realistic lead and runs all 6 stages
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={runSimulation}
          disabled={running}
        >
          {running ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <Play className="w-3.5 h-3.5 mr-1.5" />
          )}
          {running ? "Running..." : "Simulate"}
        </Button>
      </div>

      {result && (
        <div className="space-y-2 mt-3">
          {result.stages.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-sm"
            >
              {s.status === "ok" ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <span className="font-medium text-neutral-200">
                  {i + 1}. {s.stage}
                </span>
                <p className="text-xs text-neutral-500 mt-0.5 break-words">
                  {s.detail}
                </p>
              </div>
            </div>
          ))}

          {result.error && (
            <p className="text-sm text-red-400 mt-2">{result.error}</p>
          )}

          {result.success && result.leadId && (
            <div className="flex gap-2 mt-3 flex-wrap">
              <Link href={`/dashboard/leads/${result.leadId}`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-neutral-800">
                  Open lead →
                </Badge>
              </Link>
              {result.deliveryProjectId && (
                <Link href={`/dashboard/delivery/${result.deliveryProjectId}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-neutral-800">
                    Open delivery project →
                  </Badge>
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
