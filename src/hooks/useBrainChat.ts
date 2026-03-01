/**
 * React hook for streaming AI Brain chat via SSE.
 * Hydrates from DB on mount (loads most recent open session).
 * Supports session switching and cross-session context.
 */
import { useState, useCallback, useRef, useEffect } from "react";

export type ToolCallPart = {
  id: string;
  name: string;
  status: "executing" | "complete";
  input?: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

export type BrainMessagePart =
  | { type: "text"; content: string }
  | { type: "tool_call"; data: ToolCallPart }
  | { type: "error"; message: string };

export type BrainChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: BrainMessagePart[];
  timestamp: Date;
};

export type BrainSession = {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const SESSION_STORAGE_KEY = "brain-active-session";

/** Convert a DB message (contentJson) to our UI message format */
function dbMessageToUI(msg: {
  id: string;
  role: string;
  contentJson: unknown;
  createdAt: string;
}): BrainChatMessage | null {
  const content = msg.contentJson as Record<string, unknown> | null;
  if (!content) return null;

  const role = msg.role === "user" ? "user" : "assistant";
  const parts: BrainMessagePart[] = [];

  // The contentJson stores { text: "...", toolCalls?: [...] }
  if (typeof content.text === "string" && content.text) {
    parts.push({ type: "text", content: content.text });
  }

  if (Array.isArray(content.toolCalls)) {
    for (const tc of content.toolCalls) {
      const tcObj = tc as Record<string, unknown>;
      parts.push({
        type: "tool_call",
        data: {
          id: (tcObj.id as string) ?? `tc-${Math.random().toString(36).slice(2)}`,
          name: (tcObj.name as string) ?? "unknown",
          status: "complete",
          result: tcObj.hasResult ? "(loaded from history)" : undefined,
        },
      });
    }
  }

  if (parts.length === 0) return null;

  return {
    id: msg.id,
    role: role as "user" | "assistant",
    parts,
    timestamp: new Date(msg.createdAt),
  };
}

export function useBrainChat(options?: { skipHydration?: boolean }) {
  const skipHydration = options?.skipHydration ?? false;
  const [messages, setMessages] = useState<BrainChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<BrainSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(!skipHydration);
  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef(false);

  // Persist sessionId to sessionStorage
  const updateSessionId = useCallback((id: string | null) => {
    setSessionId(id);
    if (id) {
      try { sessionStorage.setItem(SESSION_STORAGE_KEY, id); } catch {}
    } else {
      try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
    }
  }, []);

  // Load session list
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/internal/copilot/sessions", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      // Silent fail — sessions list is non-critical
    }
  }, []);

  // Load a specific session's messages
  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/internal/copilot/sessions/${id}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();

      const msgs: BrainChatMessage[] = [];
      for (const m of data.messages ?? []) {
        const uiMsg = dbMessageToUI(m);
        if (uiMsg) msgs.push(uiMsg);
      }

      setMessages(msgs);
      updateSessionId(id);
    } catch {
      // If load fails, stay on current state
    }
  }, [updateSessionId]);

  // Hydrate on mount: load the last active session (skip when panel starts fresh)
  useEffect(() => {
    if (skipHydration) return;
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    async function hydrate() {
      setIsLoadingHistory(true);
      try {
        // Check sessionStorage for a persisted session ID
        let savedId: string | null = null;
        try { savedId = sessionStorage.getItem(SESSION_STORAGE_KEY); } catch {}

        // Load sessions list
        await loadSessions();

        if (savedId) {
          // Try to load the saved session
          await loadSession(savedId);
        } else {
          // Load the most recent open session
          const res = await fetch("/api/internal/copilot/sessions", {
            credentials: "include",
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            const openSessions = (data.sessions ?? []).filter(
              (s: BrainSession) => s.status === "open"
            );
            if (openSessions.length > 0) {
              await loadSession(openSessions[0].id);
            }
          }
        }
      } catch {
        // Start fresh if hydration fails
      } finally {
        setIsLoadingHistory(false);
      }
    }

    void hydrate();
  }, [loadSession, loadSessions]);

  // Switch to a different session
  const switchSession = useCallback(
    async (id: string) => {
      if (isStreaming) return;
      await loadSession(id);
    },
    [isStreaming, loadSession]
  );

  // Start a new session (clear current, close old)
  const newSession = useCallback(() => {
    if (isStreaming) return;
    setMessages([]);
    updateSessionId(null);
    void loadSessions(); // Refresh list
  }, [isStreaming, updateSessionId, loadSessions]);

  const send = useCallback(
    async (text: string, options?: { pageContext?: string; pageData?: string }) => {
      if (!text.trim() || isStreaming) return;

      // Add user message
      const userMsg: BrainChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", content: text }],
        timestamp: new Date(),
      };

      // Create assistant placeholder
      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: BrainChatMessage = {
        id: assistantId,
        role: "assistant",
        parts: [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/brain/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, sessionId, pageContext: options?.pageContext, pageData: options?.pageData }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: "Request failed" }));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    parts: [
                      { type: "error" as const, message: errBody.error || `Error ${res.status}` },
                    ],
                  }
                : m
            )
          );
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const chunk of lines) {
            const line = chunk.trim();
            if (!line.startsWith("data: ")) continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            switch (event.type) {
              case "session_id":
                updateSessionId(event.sessionId as string);
                break;

              case "text_delta":
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const parts = [...m.parts];
                    const lastPart = parts[parts.length - 1];
                    if (lastPart && lastPart.type === "text") {
                      parts[parts.length - 1] = {
                        type: "text",
                        content: lastPart.content + (event.text as string),
                      };
                    } else {
                      parts.push({
                        type: "text",
                        content: event.text as string,
                      });
                    }
                    return { ...m, parts };
                  })
                );
                break;

              case "tool_start":
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    return {
                      ...m,
                      parts: [
                        ...m.parts,
                        {
                          type: "tool_call" as const,
                          data: {
                            id: event.id as string,
                            name: event.name as string,
                            status: "executing" as const,
                          },
                        },
                      ],
                    };
                  })
                );
                break;

              case "tool_input":
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    return {
                      ...m,
                      parts: m.parts.map((p) =>
                        p.type === "tool_call" &&
                        p.data.id === (event.id as string)
                          ? {
                              ...p,
                              data: {
                                ...p.data,
                                input: event.input as Record<string, unknown>,
                              },
                            }
                          : p
                      ),
                    };
                  })
                );
                break;

              case "tool_result":
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    return {
                      ...m,
                      parts: m.parts.map((p) =>
                        p.type === "tool_call" &&
                        p.data.id === (event.id as string)
                          ? {
                              ...p,
                              data: {
                                ...p.data,
                                status: "complete" as const,
                                result: event.result,
                                error: event.error as string | undefined,
                              },
                            }
                          : p
                      ),
                    };
                  })
                );
                break;

              case "error":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          parts: [
                            ...m.parts,
                            {
                              type: "error" as const,
                              message: event.message as string,
                            },
                          ],
                        }
                      : m
                  )
                );
                break;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: [
                    ...m.parts,
                    {
                      type: "error" as const,
                      message:
                        err instanceof Error
                          ? err.message
                          : "Connection failed",
                    },
                  ],
                }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        // Refresh session list after a message completes
        void loadSessions();
      }
    },
    [isStreaming, sessionId, updateSessionId, loadSessions]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    messages,
    send,
    isStreaming,
    sessionId,
    sessions,
    isLoadingHistory,
    stop,
    newSession,
    switchSession,
    loadSessions,
  };
}
