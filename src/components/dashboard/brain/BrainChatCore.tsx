"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useBrainChat, type BrainChatMessage } from "@/hooks/useBrainChat";
import { ToolCallCard } from "@/components/dashboard/brain/ToolCallCard";
import { X } from "lucide-react";

const PRESET_PROMPTS = [
  { label: "What should I do today?", icon: ">" },
  { label: "Where am I leaking deals?", icon: "!" },
  { label: "Give me the full picture", icon: "*" },
  { label: "What's making me money?", icon: "$" },
];


function MessageBubble({ message }: { message: BrainChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-amber-600/20 border border-amber-600/30 text-neutral-100"
            : "bg-neutral-800/50 border border-neutral-700/40 text-neutral-200"
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <div
                key={i}
                className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-pre:bg-neutral-900/50 prose-pre:border prose-pre:border-neutral-700/30 prose-code:text-amber-300 prose-strong:text-neutral-100 prose-a:text-amber-400"
              >
                <ReactMarkdown>{part.content}</ReactMarkdown>
              </div>
            );
          }
          if (part.type === "tool_call") {
            return <ToolCallCard key={i} data={part.data} />;
          }
          if (part.type === "error") {
            return (
              <p key={i} className="text-red-400 text-sm mt-1">
                {part.message}
              </p>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

const AUTO_SUMMARIZE_SENTINEL = "__auto_summarize__";

export function BrainChatCore({
  mode,
  pageContext,
  pageData,
  onClose,
}: {
  mode: "full" | "panel";
  pageContext?: string;
  pageData?: string | null;
  onClose?: () => void;
}) {
  const isPanel = mode === "panel";
  const pathname = usePathname();

  const {
    messages,
    send,
    isStreaming,
    isLoadingHistory,
    stop,
  } = useBrainChat({ skipHydration: isPanel });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount and when history finishes loading
  useEffect(() => {
    if (!isLoadingHistory) {
      inputRef.current?.focus();
    }
  }, [isLoadingHistory]);

  const sendWithContext = useCallback(
    (text: string) => {
      const opts: { pageContext?: string; pageData?: string } = {};
      if (mode === "panel" && pageContext) opts.pageContext = pageContext;
      if (pageData) opts.pageData = pageData;
      send(text, Object.keys(opts).length > 0 ? opts : undefined);
    },
    [send, mode, pageContext, pageData]
  );

  // Auto-send summary when panel opens with page data
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (
      mode === "panel" &&
      !autoSentRef.current &&
      pageData &&
      messages.length === 0 &&
      !isStreaming
    ) {
      autoSentRef.current = true;
      sendWithContext(AUTO_SUMMARIZE_SENTINEL);
    }
  }, [mode, pageData, messages.length, isStreaming, sendWithContext]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendWithContext(input);
    setInput("");
  };

  const handlePreset = (prompt: string) => {
    if (isStreaming) return;
    sendWithContext(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Filter out the auto-summarize sentinel from visible messages
  const visibleMessages = messages.filter(
    (m) =>
      !(
        m.role === "user" &&
        m.parts.length === 1 &&
        m.parts[0].type === "text" &&
        m.parts[0].content === AUTO_SUMMARIZE_SENTINEL
      )
  );

  const isEmpty = visibleMessages.length === 0 && !isLoadingHistory && !isStreaming;

  return (
    <div className={`flex flex-col ${isPanel ? "h-full" : "h-[calc(100vh-5rem)]"}`}>
      {/* Panel header */}
      {isPanel && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">&#9733;</span>
            <span className="text-sm font-medium text-neutral-200">AI Brain</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-300 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto p-4 ${
          isPanel ? "" : "border border-neutral-800/60 rounded-lg bg-neutral-900/30"
        }`}
      >
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Loading conversation...
            </div>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <span className={`mb-3 ${isPanel ? "text-2xl" : "text-4xl mb-4"}`}>&#9733;</span>
            <h2 className={`font-medium text-neutral-200 mb-2 ${isPanel ? "text-base" : "text-lg"}`}>
              {isPanel ? "Ask anything" : "What do you want to know?"}
            </h2>
            <p className={`text-neutral-500 mb-4 max-w-md ${isPanel ? "text-xs" : "text-sm mb-6"}`}>
              {isPanel
                ? "I can see your pipeline, risks, knowledge base, and more."
                : "I have access to your pipeline, deals, risk rules, growth data, knowledge base, and memory patterns. Ask me anything."}
            </p>
            <div className={`flex flex-wrap gap-2 justify-center ${isPanel ? "max-w-sm" : "max-w-lg"}`}>
              {PRESET_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePreset(p.label)}
                  className={`flex items-center gap-2 text-neutral-300 bg-neutral-800/60 border border-neutral-700/40 rounded-lg hover:bg-neutral-700/50 hover:border-neutral-600 transition-colors ${
                    isPanel ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
                  }`}
                >
                  <span className="text-amber-400 font-mono text-xs">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {visibleMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && (
              <div className="flex justify-start mb-4">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Thinking...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className={`flex gap-2 ${isPanel ? "p-3 border-t border-neutral-800" : "mt-3"}`}>
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isPanel ? "Ask the Brain..." : "Ask the Brain anything..."}
            rows={1}
            className="w-full resize-none rounded-lg border border-neutral-700/60 bg-neutral-800/50 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
          />
        </div>
        {isStreaming ? (
          <button
            type="button"
            onClick={stop}
            className="px-4 py-3 rounded-lg bg-red-600/20 border border-red-600/30 text-red-400 text-sm font-medium hover:bg-red-600/30 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-3 rounded-lg bg-amber-600/20 border border-amber-600/30 text-amber-400 text-sm font-medium hover:bg-amber-600/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
