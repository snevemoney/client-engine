"use client";

/**
 * Phase 3.4: Score alerts preferences page.
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertsPreferencesPanel } from "@/components/scores";
import { ArrowLeft } from "lucide-react";

export default function ScoreAlertsPreferencesPage() {
  return (
    <div className="space-y-6 min-w-0 max-w-2xl">
      <div>
        <Link href="/dashboard/internal/scoreboard">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Scoreboard
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Score alert preferences</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Control which score events (threshold breach, sharp drop, recovery) generate notifications.
        </p>
      </div>

      <AlertsPreferencesPanel />
    </div>
  );
}
