/**
 * React hook for streaming AI Brain chat via SSE.
 */
import { useState, useCallback, useRef } from "react";

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

export function useBrainChat() {
  const [messages, setMessages] = useState<BrainChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
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
          body: JSON.stringify({ message: text, sessionId }),
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
                setSessionId(event.sessionId as string);
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
      }
    },
    [isStreaming, sessionId]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

  return { messages, send, isStreaming, sessionId, stop, clearHistory };
}
