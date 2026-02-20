import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  default_branch: string;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoUrl } = await req.json();
  if (!repoUrl) {
    return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
  }

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) {
    return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
  }

  const [, owner, repo] = match;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

  const ghRes = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });

  if (!ghRes.ok) {
    return NextResponse.json({ error: `GitHub API returned ${ghRes.status}` }, { status: 502 });
  }

  const gh: GitHubRepo = await ghRes.json();
  const slug = slugify(gh.name);

  const project = await db.project.upsert({
    where: { slug },
    update: {
      name: gh.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: gh.description,
      repoUrl: gh.html_url,
      demoUrl: gh.homepage || undefined,
      techStack: gh.topics.length > 0 ? gh.topics : gh.language ? [gh.language] : [],
      updatedAt: new Date(),
    },
    create: {
      slug,
      name: gh.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: gh.description,
      repoUrl: gh.html_url,
      demoUrl: gh.homepage || undefined,
      techStack: gh.topics.length > 0 ? gh.topics : gh.language ? [gh.language] : [],
      status: "live",
    },
  });

  return NextResponse.json(project, { status: 200 });
}
