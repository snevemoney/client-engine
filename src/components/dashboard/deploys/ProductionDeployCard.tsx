"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DEPLOY_CMD = "ssh root@69.62.66.78 '/root/deploy-client-engine.sh'";

export function ProductionDeployCard() {
  const [health, setHealth] = useState<{ ok: boolean; checks?: Record<string, { ok?: boolean }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        setHealth(d);
      })
      .catch(() => setHealth({ ok: false }))
      .finally(() => setLoading(false));
  }, []);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(DEPLOY_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Production deploy</h2>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Health:</span>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
          ) : health?.ok ? (
            <span className="text-emerald-400">OK</span>
          ) : (
            <span className="text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> Not OK or unreachable
            </span>
          )}
        </div>
        <div>
          <p className="text-neutral-500 text-xs mb-1.5">One-command deploy (from your machine):</p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="flex-1 min-w-0 text-xs text-neutral-300 bg-neutral-800/80 border border-neutral-700 rounded px-2 py-1.5 truncate">
              {DEPLOY_CMD}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-8 text-xs"
              onClick={copyCommand}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <p className="text-neutral-500 text-xs">
          Setup: docs/DEPLOY_SSH_SETUP.md
        </p>
      </div>
    </section>
  );
}
