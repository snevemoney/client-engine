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
  role: "user" | "coach" | "system",
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
