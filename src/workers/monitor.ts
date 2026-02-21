import https from "https";
import http from "http";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface CheckResult {
  url: string;
  status: "ok" | "warning" | "error";
  message: string;
  responseTime?: number;
}

async function checkUrl(url: string, timeoutMs = 10000): Promise<CheckResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith("https") ? https : http;

    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      const elapsed = Date.now() - start;
      const status = res.statusCode || 0;

      if (status >= 200 && status < 400) {
        resolve({ url, status: "ok", message: `HTTP ${status} (${elapsed}ms)`, responseTime: elapsed });
      } else if (status >= 400 && status < 500) {
        resolve({ url, status: "warning", message: `HTTP ${status} — client error`, responseTime: elapsed });
      } else {
        resolve({ url, status: "error", message: `HTTP ${status}`, responseTime: elapsed });
      }
      res.resume();
    });

    req.on("error", (err) => {
      resolve({ url, status: "error", message: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ url, status: "error", message: `Timeout after ${timeoutMs}ms` });
    });
  });
}

async function checkSslExpiry(hostname: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    const req = https.get({ hostname, port: 443, method: "HEAD" }, (res) => {
      const socket = res.socket as { getPeerCertificate?: () => { valid_to?: string } | null };
      if (socket.getPeerCertificate) {
        const cert = socket.getPeerCertificate();
        if (cert && cert.valid_to) {
          const expiry = new Date(cert.valid_to);
          const daysLeft = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysLeft < 7) {
            resolve({ url: hostname, status: "error", message: `SSL expires in ${daysLeft} days (${cert.valid_to})` });
          } else if (daysLeft < 30) {
            resolve({ url: hostname, status: "warning", message: `SSL expires in ${daysLeft} days` });
          } else {
            resolve({ url: hostname, status: "ok", message: `SSL valid for ${daysLeft} days` });
          }
        } else {
          resolve({ url: hostname, status: "warning", message: "Could not read certificate" });
        }
      } else {
        resolve({ url: hostname, status: "warning", message: "No certificate info" });
      }
      res.resume();
    });

    req.on("error", (err) => {
      resolve({ url: hostname, status: "error", message: `SSL check failed: ${err.message}` });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ url: hostname, status: "error", message: "SSL check timeout" });
    });
  });
}

export async function runMonitor() {
  const sites = (process.env.MONITOR_URLS || "https://evenslouis.ca").split(",").map((s) => s.trim()).filter(Boolean);

  console.log(`[monitor] Checking ${sites.length} site(s)...`);

  const results: CheckResult[] = [];

  for (const url of sites) {
    const uptimeResult = await checkUrl(url);
    results.push(uptimeResult);
    console.log(`[monitor] ${uptimeResult.status.toUpperCase()} ${url}: ${uptimeResult.message}`);

    try {
      const hostname = new URL(url).hostname;
      const sslResult = await checkSslExpiry(hostname);
      results.push(sslResult);
      console.log(`[monitor] SSL ${hostname}: ${sslResult.message}`);
    } catch {}
  }

  const issues = results.filter((r) => r.status !== "ok");
  if (issues.length > 0) {
    for (const issue of issues) {
      const existing = await db.artifact.findFirst({
        where: {
          type: "notes",
          title: { contains: `Monitor: ${issue.url}` },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      if (!existing) {
        console.log(`[monitor] Creating issue for: ${issue.url}`);
      }
    }
  }

  console.log(`[monitor] Done. ${results.filter((r) => r.status === "ok").length}/${results.length} checks passed.`);
}
