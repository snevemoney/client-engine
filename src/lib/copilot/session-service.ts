/**
 * Phase 5.3: Copilot session persistence.
 */
import { db } from "@/lib/db";

export async function createSession(opts?: {
  entityType?: string;
  entityId?: string;
  title?: string;
}) {
  return db.copilotSession.create({
    data: {
      entityType: opts?.entityType ?? "command_center",
      entityId: opts?.entityId ?? "command_center",
      title: opts?.title ?? null,
      status: "open",
    },
  });
}

export async function addMessage(
  sessionId: string,
  role: "user" | "coach" | "system" | "brain",
  contentJson: object,
  sourcesJson?: object,
  metaJson?: object
) {
  return db.copilotMessage.create({
    data: {
      sessionId,
      role,
      contentJson: contentJson as object,
      sourcesJson: sourcesJson as object | undefined,
      metaJson: metaJson as object | undefined,
    },
  });
}

export async function addActionLog(
  sessionId: string,
  data: {
    actionKey: string;
    mode: string;
    nextActionId?: string;
    nbaActionKey?: string;
    beforeJson?: object;
    afterJson?: object;
    resultJson?: object;
    status: "success" | "failed";
    errorMessage?: string;
  }
) {
  return db.copilotActionLog.create({
    data: {
      sessionId,
      actionKey: data.actionKey,
      mode: data.mode,
      nextActionId: data.nextActionId ?? null,
      nbaActionKey: data.nbaActionKey ?? null,
      beforeJson: (data.beforeJson ?? {}) as object,
      afterJson: (data.afterJson ?? {}) as object,
      resultJson: (data.resultJson ?? {}) as object,
      status: data.status,
      errorMessage: data.errorMessage ?? null,
    },
  });
}

export async function getSession(sessionId: string) {
  return db.copilotSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      actionLogs: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function listSessions(opts?: { limit?: number }) {
  return db.copilotSession.findMany({
    orderBy: { updatedAt: "desc" },
    take: opts?.limit ?? 20,
    select: {
      id: true,
      title: true,
      entityType: true,
      entityId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function closeSession(sessionId: string) {
  return db.copilotSession.update({
    where: { id: sessionId },
    data: { status: "closed" },
  });
}

/**
 * Load brain conversation history in Anthropic message format.
 * Converts stored CopilotMessages to the { role, content } pairs
 * that the Anthropic API expects. Limits to last 20 messages.
 */
export async function loadBrainHistory(
  sessionId: string
): Promise<Array<{ role: "user" | "assistant"; content: unknown }>> {
  const messages = await db.copilotMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { role: true, contentJson: true },
    take: 40,
  });

  // Take the last 20 messages to cap context size
  const recent = messages.slice(-20);

  return recent
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content:
        typeof m.contentJson === "object" &&
        m.contentJson !== null &&
        "text" in m.contentJson
          ? String((m.contentJson as { text: unknown }).text)
          : typeof m.contentJson === "string"
            ? m.contentJson
            : "",
    }))
    .filter((m) => m.content !== "");
}

/**
 * Build a summary of recent past sessions for cross-session memory.
 * Extracts key topics discussed and actions taken from the last N sessions
 * (excluding the current one). Returns a compact text block for system prompt injection.
 */
export async function buildCrossSessionContext(
  excludeSessionId?: string
): Promise<string | null> {
  const recentSessions = await db.copilotSession.findMany({
    where: {
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 6, // First 3 exchanges per session
        select: { role: true, contentJson: true },
      },
    },
  });

  if (recentSessions.length === 0) return null;

  const summaries: string[] = [];

  for (const s of recentSessions) {
    const userMessages = s.messages
      .filter((m) => m.role === "user")
      .map((m) => {
        const content = m.contentJson as Record<string, unknown> | null;
        return typeof content?.text === "string" ? content.text : "";
      })
      .filter(Boolean);

    const brainMessages = s.messages
      .filter((m) => m.role !== "user")
      .map((m) => {
        const content = m.contentJson as Record<string, unknown> | null;
        const text = typeof content?.text === "string" ? content.text : "";
        // Truncate long responses to key points
        return text.length > 300 ? text.slice(0, 300) + "..." : text;
      })
      .filter(Boolean);

    if (userMessages.length === 0) continue;

    const dateStr = s.updatedAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const title = s.title || userMessages[0].slice(0, 60);

    summaries.push(
      `[${dateStr}] "${title}"\n  User asked: ${userMessages.join(" | ")}\n  Key points: ${brainMessages[0] ?? "(no response)"}`
    );
  }

  if (summaries.length === 0) return null;

  return `## Recent Conversation History\nThe operator has had these recent conversations with you. Use this context to provide continuity:\n\n${summaries.join("\n\n")}`;
}
