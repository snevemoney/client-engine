/**
 * AI Brain full-page chat interface.
 * Uses shared BrainChatCore with session history sidebar.
 */
"use client";

import { useState } from "react";
import { useBrainChat, type BrainSession } from "@/hooks/useBrainChat";
import { BrainChatCore } from "@/components/dashboard/brain/BrainChatCore";
import { Clock, Plus, MessageSquare, ChevronLeft } from "lucide-react";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
}: {
  sessions: BrainSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-amber-400 rounded-md hover:bg-neutral-800/50 transition-colors"
      >
        <Plus className="w-4 h-4" />
        New chat
      </button>
      {sessions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className={`flex items-start gap-2 w-full px-3 py-2 text-left text-sm rounded-md transition-colors ${
            s.id === activeSessionId
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs">
              {s.title || "Untitled chat"}
            </p>
            <p className="text-[10px] text-neutral-600 mt-0.5">
              {timeAgo(s.updatedAt)}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function BrainChatContent() {
  const {
    messages,
    sessionId,
    sessions,
    newSession,
    switchSession,
  } = useBrainChat();
  const [showHistory, setShowHistory] = useState(false);

  const handleSessionSelect = (id: string) => {
    switchSession(id);
    setShowHistory(false);
  };

  const handleNewSession = () => {
    newSession();
    setShowHistory(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {showHistory && (
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="text-neutral-400 hover:text-neutral-200 p-1 rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-neutral-100 flex items-center gap-2">
              <span className="text-amber-400">&#9733;</span> AI Brain
            </h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Your strategic advisor — powered by Claude
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 px-3 py-1.5 rounded border border-neutral-700/50 hover:border-neutral-600 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            History
            {sessions.length > 0 && (
              <span className="text-[10px] text-neutral-600 ml-1">
                {sessions.length}
              </span>
            )}
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleNewSession}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 px-3 py-1.5 rounded border border-neutral-700/50 hover:border-neutral-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New chat
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Session history panel */}
        {showHistory && (
          <div className="w-56 shrink-0 border border-neutral-800/60 rounded-lg bg-neutral-900/30 p-2 overflow-y-auto">
            <p className="text-xs text-neutral-600 uppercase tracking-wider px-3 py-1.5 mb-1">
              Recent chats
            </p>
            <SessionList
              sessions={sessions}
              activeSessionId={sessionId}
              onSelect={handleSessionSelect}
              onNew={handleNewSession}
            />
          </div>
        )}

        {/* Chat core */}
        <div className="flex-1 min-w-0">
          <BrainChatCore mode="full" />
        </div>
      </div>
    </div>
  );
}
