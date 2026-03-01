/**
 * AI Brain chat API — streaming endpoint with tool_use support.
 * POST /api/brain/chat
 * Body: { message: string, sessionId?: string }
 * Returns: SSE stream with text_delta, tool_start, tool_result, done events.
 */
import { NextRequest } from "next/server";
import { requireAuth, jsonError } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import {
  createSession,
  addMessage,
  loadBrainHistory,
  buildCrossSessionContext,
} from "@/lib/copilot/session-service";
import { streamBrainWithTools } from "@/lib/brain/stream";
import { isWriteTool } from "@/lib/brain/executor";
import type { BrainMessage } from "@/lib/llm/anthropic";
import { logOpsEventSafe } from "@/lib/ops-events/log";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Auth
  const session = await requireAuth();
  if (!session) return jsonError("Unauthorized", 401);
  const userId = session.user?.id;
  if (!userId) return jsonError("User ID missing", 401);

  // Rate limit: 30 req/min per user
  const clientKey = getRequestClientKey(request);
  const rl = rateLimitByKey({
    key: `brain:chat:${clientKey}`,
    windowMs: 60_000,
    max: 30,
  });
  if (!rl.ok) {
    return jsonError("Too many requests", 429, "rate_limited", {
      headers: {
        "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
      },
    });
  }

  // Parse body
  let body: { message?: string; sessionId?: string; pageContext?: string; pageData?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const AUTO_SUMMARIZE_SENTINEL = "__auto_summarize__";
  let message = body.message?.trim();
  if (!message) return jsonError("message is required", 400);

  // Transform auto-summarize sentinel into a readable instruction
  const isAutoSummarize = message === AUTO_SUMMARIZE_SENTINEL;
  if (isAutoSummarize) {
    message = "Summarize what I'm looking at on this page and highlight any items that need my attention.";
  }

  // Session management
  let sessionId = body.sessionId;
  if (!sessionId) {
    const newSession = await createSession({
      entityType: "command_center",
      entityId: "command_center",
      title: message.slice(0, 100),
    });
    sessionId = newSession.id;
  }

  // Store user message
  await addMessage(sessionId, "user", { text: message });

  // Load conversation history
  let conversationHistory: BrainMessage[] = [];
  let crossSessionContext: string | null = null;

  if (body.sessionId) {
    const history = await loadBrainHistory(sessionId);
    // Filter out the message we just added (it'll be passed separately)
    conversationHistory = history.slice(0, -1) as BrainMessage[];
  } else {
    // New session: inject cross-session context so Brain remembers past conversations
    try {
      crossSessionContext = await buildCrossSessionContext(sessionId);
    } catch {
      // Non-blocking
    }
  }

  // Build tool context
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";
  const baseUrl = `${protocol}://${host}`;
  const cookie = request.headers.get("cookie") || undefined;

  const toolContext = {
    userId,
    baseUrl,
    cookie,
    entityType: "command_center",
    entityId: "command_center",
  };

  logOpsEventSafe({
    category: "api_action",
    eventKey: "brain.chat.started",
    actorType: "user",
    actorId: userId,
    meta: { sessionId, messageLength: message.length },
  });

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send session ID first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "session_id", sessionId })}\n\n`
          )
        );

        let fullResponse = "";
        const toolCalls: Array<{
          name: string;
          input: unknown;
          result: unknown;
        }> = [];

        const pageContextSuffix = body.pageContext
          ? `\n\n## Current Page Context\nThe user is currently viewing: ${body.pageContext}. Consider this when answering — they may be asking about what they see on this page.`
          : "";
        const pageDataSuffix = body.pageData
          ? `\n\n## Live Page Data\n${body.pageData}`
          : "";
        const systemSuffix = [crossSessionContext, pageContextSuffix, pageDataSuffix].filter(Boolean).join("\n\n") || undefined;

        for await (const event of streamBrainWithTools({
          userMessage: message,
          conversationHistory,
          toolContext,
          systemSuffix,
        })) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );

          // Collect response text
          if (event.type === "text_delta") {
            fullResponse += event.text;
          }

          // Track tool calls for memory ingestion
          if (event.type === "tool_result") {
            toolCalls.push({
              name: event.name,
              input: {},
              result: event.result,
            });
          }
        }

        // Store brain response
        await addMessage(sessionId!, "brain", {
          text: fullResponse,
          toolCalls: toolCalls.map((tc) => ({
            name: tc.name,
            hasResult: !!tc.result,
          })),
        });

        // Memory ingestion for write tools
        if (toolCalls.some((tc) => isWriteTool(tc.name))) {
          try {
            const { ingestFromBrainConversation } = await import(
              "@/lib/memory/brain-ingest"
            );
            await ingestFromBrainConversation({
              sessionId: sessionId!,
              userId,
              toolCalls,
              userMessage: message,
            });
          } catch {
            // Best-effort memory ingestion
          }
        }

        logOpsEventSafe({
          category: "api_action",
          eventKey: "brain.chat.completed",
          actorType: "user",
          actorId: userId,
          meta: {
            sessionId,
            responseLength: fullResponse.length,
            toolCallCount: toolCalls.length,
          },
        });
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Brain stream failed";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: errorMsg })}\n\n`
          )
        );

        logOpsEventSafe({
          category: "api_action",
          eventKey: "brain.chat.failed",
          status: "failure",
          actorType: "user",
          actorId: userId,
          errorMessage: errorMsg,
          meta: { sessionId },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
