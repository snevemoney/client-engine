"use client";

import dynamic from "next/dynamic";

const ChatContent = dynamic(() => import("./ChatContent"), {
  loading: () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-44 rounded bg-muted" />
      <div className="h-4 w-80 rounded bg-muted" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-8 w-36 rounded bg-muted" />
        ))}
      </div>
      <div className="border border-neutral-800 rounded-lg flex-1 h-[calc(100vh-16rem)]">
        <div className="p-4 space-y-3">
          <div className="h-4 w-64 rounded bg-muted" />
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-8 w-44 rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
  ssr: false,
});

export default function ChatPage() {
  return <ChatContent />;
}
