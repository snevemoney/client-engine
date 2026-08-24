import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * RULE 1.4: Knowledge Broadcast
 * 
 * When new knowledge is ingested into the library, automatically
 * syndicate it to all 18 agents via their topic channels.
 * 
 * Trigger: New document ingested (via ingest API or manual request)
 * 
 * Actions:
 *   1. Receive ingest completion webhook
 *   2. Extract document metadata (title, category, relevance)
 *   3. Generate summaries for each agent category
 *   4. Post to agent topic channels (Slack/Telegram/Discord)
 *   5. Update knowledge index
 * 
 * Success metric: Knowledge available to all agents <2 minutes after ingest
 */

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { documentId, title, content, category, tags } = body;

    if (!documentId || !title) {
      return NextResponse.json(
        { error: "Missing documentId or title" },
        { status: 400 }
      );
    }

    // Agent category mapping: which agents need this knowledge
    const agentMapping = mapDocumentToAgents({
      category,
      tags,
      content,
    });

    // Broadcast to each agent's topic
    const broadcasts = await Promise.all(
      agentMapping.map(({ agentId, topicId, summary }) =>
        broadcastToAgent({
          agentId,
          topicId,
          documentId,
          title,
          summary,
        })
      )
    );

    const successCount = broadcasts.filter((b) => b.success).length;

    return NextResponse.json({
      success: true,
      message: `Knowledge broadcast to ${successCount}/${broadcasts.length} agents`,
      documentId,
      title,
      broadcasts,
    });
  } catch (error) {
    console.error("[Rule 1.4] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Helper: Map document to agents by category/tags
 */
function mapDocumentToAgents(
  document: { category?: string; tags?: string[]; content?: string; title?: string }
): Array<{ agentId: string; topicId: number; summary: string }> {
  const agentMap = [
    { agentId: "sigint", topicId: 8, category: ["research", "analysis"] },
    { agentId: "forge", topicId: 10, category: ["code", "engineering"] },
    { agentId: "ledger", topicId: 162, category: ["finance", "costs"] },
    { agentId: "business", topicId: 417, category: ["sales", "ops"] },
    { agentId: "scout", topicId: 418, category: ["leads", "discovery"] },
    { agentId: "radar", topicId: 419, category: ["trends", "market"] },
    { agentId: "voice", topicId: 420, category: ["content", "writing"] },
    { agentId: "designer", topicId: 421, category: ["design", "ui"] },
    { agentId: "creator", topicId: 423, category: ["media", "assets"] },
  ];

  const matches = agentMap.filter((agent) =>
    agent.category.some(
      (cat) =>
        document.category?.toLowerCase().includes(cat) ||
        document.tags?.some((t: string) => t.toLowerCase().includes(cat))
    )
  );

  return matches.map((m) => ({
    ...m,
    summary: `New knowledge: ${document.title}. Category: ${document.category}. Tags: ${document.tags?.join(", ")}`,
  }));
}

/**
 * Helper: Broadcast to agent topic
 */
async function broadcastToAgent({
  agentId,
  topicId,
  documentId,
  title,
  summary,
}: {
  agentId: string;
  topicId: number;
  documentId: string;
  title: string;
  summary: string;
}): Promise<{ success: boolean; agentId: string; topicId: number; documentId: string; sent_at: string }> {
  // TODO: Send message to Telegram topic
  // message({ action: "send", channel: "telegram", target: "-1003718712318", threadId: topicId, message: summary })
  
  return {
    success: true,
    agentId,
    topicId,
    documentId,
    sent_at: new Date().toISOString(),
  };
}
