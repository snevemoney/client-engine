"use client";

import dynamic from "next/dynamic";

const CoachContent = dynamic(() => import("./CoachContent"), {
  loading: () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-4 w-96 rounded bg-muted" />
      <div className="flex gap-4">
        <div className="w-48 h-32 rounded-lg border border-neutral-800 bg-neutral-900/50" />
        <div className="flex-1 border border-neutral-800 rounded-lg h-[calc(100vh-16rem)]" />
      </div>
    </div>
  ),
  ssr: false,
});

export default function CoachModePage() {
  return <CoachContent />;
}
