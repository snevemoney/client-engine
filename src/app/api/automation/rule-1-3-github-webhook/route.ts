import { NextRequest, NextResponse } from "next/server";

/**
 * RULE 1.3: GitHub→Forge Webhook Trigger
 * 
 * Automatically runs tests and deploys code when PR is merged to main.
 * 
 * Trigger: GitHub push webhook (on main branch)
 * 
 * Actions:
 *   1. Receive webhook from GitHub
 *   2. Verify webhook signature (GitHub security)
 *   3. Invoke Forge agent: run npm test + npm build
 *   4. If tests pass: auto-deploy to staging
 *   5. Post status back to GitHub (✅ or ❌)
 * 
 * Success metric: Code deployed <10 minutes after merge
 */

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    // Verify GitHub webhook signature
    const signature = req.headers.get("x-hub-signature-256");
    const body = await req.text();

    if (!verifyGitHubSignature(body, signature || "")) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body);

    // Only process push events to main branch
    if (payload.ref !== "refs/heads/main") {
      return NextResponse.json({ message: "Skipped (not main branch)" });
    }

    const commitMessage = payload.head_commit?.message || "";
    const commitSha = payload.head_commit?.id || "";
    const repoName = payload.repository?.name || "";

    // Trigger Forge: run tests + build
    const forgeTask = await triggerForge({
      action: "test_and_build",
      commitSha,
      commitMessage,
      repoName,
    });

    if (!forgeTask.success) {
      // Post failure to GitHub
      await postGitHubStatus({
        sha: commitSha,
        state: "failure",
        description: "Build/test job failed",
      });

      return NextResponse.json(
        { error: "Forge task failed", details: forgeTask },
        { status: 500 }
      );
    }

    // Post success to GitHub
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
  } catch (error) {
    console.error("[Rule 1.3] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Helper: Verify GitHub webhook signature
 */
function verifyGitHubSignature(body: string, signature: string): boolean {
  // TODO: Implement HMAC-SHA256 verification
  // For now, return true for testing
  return true;
}

/**
 * Helper: Trigger Forge agent
 */
async function triggerForge(task: any): Promise<any> {
  // TODO: Use sessions_send to invoke Forge agent
  // For now, return mock success
  return {
    success: true,
    jobId: `forge-${Date.now()}`,
    action: task.action,
  };
}

/**
 * Helper: Post status to GitHub commit
 */
async function postGitHubStatus(status: {
  sha: string;
  state: "pending" | "success" | "failure";
  description: string;
}): Promise<void> {
  // TODO: Use GitHub API to post commit status
  // POST /repos/{owner}/{repo}/statuses/{sha}
  console.log("[Rule 1.3] GitHub status:", status);
}
