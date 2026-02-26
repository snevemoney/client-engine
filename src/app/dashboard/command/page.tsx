import { Suspense } from "react";
import { CommandHeader } from "@/components/dashboard/command/CommandHeader";
import { RiskNBACard } from "@/components/dashboard/command/RiskNBACard";
import { FlywheelSimCard } from "@/components/dashboard/command/FlywheelSimCard";
import CommandSection1 from "./CommandSection1";
import CommandSection2 from "./CommandSection2";

const IS_PROD = process.env.NODE_ENV === "production";

export const dynamic = "force-dynamic";

function Section2Fallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-32 rounded-lg bg-muted" />
        <div className="h-32 rounded-lg bg-muted" />
      </div>
      <div className="h-28 rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-lg bg-muted" />
        <div className="h-40 rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export default function CommandCenterPage() {
  return (
    <div className="space-y-6 min-w-0">
      <CommandHeader />

      <RiskNBACard />
      {!IS_PROD && <FlywheelSimCard />}
      <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted" />}>
        <CommandSection1 />
      </Suspense>

      <Suspense fallback={<Section2Fallback />}>
        <CommandSection2 />
      </Suspense>
    </div>
  );
}
