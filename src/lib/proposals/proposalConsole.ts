/**
 * Client helpers for the proposal console: fetch and patch proposal artifacts.
 * Uses GET/PATCH /api/artifacts/[id] with content and proposalConsole shape.
 */

import type { ProposalSections } from "./sections";

export type ProposalSectionsShape = {
  opening: string;
  upworkSnippet: string;
  questions: string;
};

export type ProposalConsoleArtifact = {
  id: string;
  leadId: string;
  type: string;
  title: string;
  content: string;
  meta: Record<string, unknown>;
  createdAt: string;
  lead?: {
    id: string;
    title: string;
    status: string;
    proposalSentAt?: string | null;
  };
  proposalConsole: {
    sections: ProposalSectionsShape;
    readyToSend: boolean;
    sentOnUpwork: boolean;
  };
};

export async function fetchProposalArtifact(id: string): Promise<ProposalConsoleArtifact> {
  const res = await fetch(`/api/artifacts/${id}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to load proposal artifact");
  }
  const data = await res.json();
  return data;
}

export async function patchProposalArtifact(
  id: string,
  payload: {
    sections?: Partial<ProposalSections>;
    readyToSend?: boolean;
    sentOnUpwork?: boolean;
    title?: string;
    content?: string;
    meta?: Record<string, unknown>;
  }
): Promise<{ artifact: ProposalConsoleArtifact }> {
  const res = await fetch(`/api/artifacts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to save proposal artifact");
  }

  return res.json();
}
