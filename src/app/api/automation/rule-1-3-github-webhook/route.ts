import { NextRequest, NextResponse } from "next/server";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { verifyGitHubWebhookSignature } from "@/lib/crypto/hmac";

/**
 * RULE 1.3: GitHub webhook receiver.
 *
 * Verifies `x-hub-signature-256` (HMAC-SHA256 of the raw body) and fails closed
 * when GITHUB_WEBHOOK_SECRET is unset. Forge invoke and GitHub commit status
 * remain stubs — this route does not deploy.
 */

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/automation/rule-1-3-github-webhook", async () => {
    const signature = req.headers.get("x-hub-signature-256");
    const body = await req.text();

    if (!verifyGitHubWebhookSignature({
      secret: process.env.GITHUB_WEBHOOK_SECRET,
      signatureHeader: signature,
      rawBody: body,
    })) {
      return jsonError("Invalid webhook signature", 401);
    }

    let payload: {
      ref?: string;
      head_commit?: { message?: string; id?: string };
      repository?: { name?: string };
    };
    try {
      payload = JSON.parse(body) as typeof payload;
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    if (payload.ref !== "refs/heads/main") {
      return NextResponse.json({ message: "Skipped (not main branch)" });
    }

    const commitMessage = payload.head_commit?.message || "";
    const commitSha = payload.head_commit?.id || "";
    const repoName = payload.repository?.name || "";

    const forgeTask = await triggerForge({
      action: "test_and_build",
      commitSha,
      commitMessage,
      repoName,
    });

    if (!forgeTask.success) {
      await postGitHubStatus({
        sha: commitSha,
        state: "failure",
        description: "Build/test job failed",
      });
      return jsonError("Forge task failed", 500);
    }

    await postGitHubStatus({
      sha: commitSha,
      state: "success",
      description: "Build and tests passed",
    });

    return NextResponse.json({
      success: true,
      message: "GitHub webhook processed",
      commit: commitSha,
      action: "test_and_build",
      forgeJobId: forgeTask.jobId,
    });
  });
}

/** Stub: does not invoke a real agent or deploy. */
async function triggerForge(task: {
  action: string;
  commitSha: string;
  commitMessage: string;
  repoName: string;
}): Promise<{ success: boolean; jobId: string; action: string }> {
  return {
    success: true,
    jobId: `forge-${Date.now()}`,
    action: task.action,
  };
}

/** Stub: logs only. Does not call the GitHub Statuses API. */
async function postGitHubStatus(status: {
  sha: string;
  state: "pending" | "success" | "failure";
  description: string;
}): Promise<void> {
  console.log("[Rule 1.3] GitHub status (stub):", status);
}
