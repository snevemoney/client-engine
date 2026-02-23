"use client";

import { useEffect, useState } from "react";
import { Heart, CheckCircle2, AlertTriangle, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { AssetHealthResult } from "@/lib/meta-ads/asset-health";

export function MetaAdsHealthPageClient() {
  const [data, setData] = useState<AssetHealthResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/meta-ads/asset-health")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 min-w-0">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Heart className="w-6 h-6 text-neutral-400" />
          Meta Asset Health
        </h1>
        <div className="h-48 rounded-lg bg-neutral-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/meta-ads"
          className="text-neutral-400 hover:text-neutral-200 flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Meta Ads
        </Link>
      </div>
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Heart className="w-6 h-6 text-neutral-400" />
        Meta Asset Health
      </h1>
      <p className="text-sm text-neutral-400">
        Read-only diagnostics — what is connected and what is missing.
      </p>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Connection summary */}
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300 mb-3">Connection summary</h2>
            <div className="flex items-center gap-2">
              {data.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span className={data.ok ? "text-emerald-400" : "text-red-400"}>
                {data.ok ? "Integration healthy" : "Issues detected"}
              </span>
            </div>
          </section>

          {/* Account */}
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300 mb-3">Ad account</h2>
            <dl className="text-sm space-y-1">
              <div><dt className="text-neutral-500 inline">ID:</dt> <dd className="inline text-neutral-200 font-mono">{data.account.id}</dd></div>
              {data.account.name && <div><dt className="text-neutral-500 inline">Name:</dt> <dd className="inline text-neutral-200">{data.account.name}</dd></div>}
              {data.account.currency && <div><dt className="text-neutral-500 inline">Currency:</dt> <dd className="inline text-neutral-200">{data.account.currency}</dd></div>}
              {data.account.timezone_name && <div><dt className="text-neutral-500 inline">Timezone:</dt> <dd className="inline text-neutral-200">{data.account.timezone_name}</dd></div>}
            </dl>
          </section>

          {/* Permissions */}
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300 mb-3">Permissions (token)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {Object.entries(data.permissions).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  {v ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-neutral-600" />}
                  <code className="text-neutral-400">{k}</code>
                </div>
              ))}
            </div>
          </section>

          {/* Checks */}
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300 mb-3">Checks</h2>
            <div className="space-y-2">
              {data.checks.map((c) => (
                <div
                  key={c.key}
                  className={`flex items-start gap-2 rounded p-2 text-sm ${
                    c.status === "pass" ? "bg-emerald-950/20" : c.status === "warn" ? "bg-amber-950/20" : "bg-red-950/20"
                  }`}
                >
                  {c.status === "pass" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : c.status === "warn" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-medium text-neutral-200">{c.label}</span>
                    <p className="text-neutral-500 text-xs mt-0.5">{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pages */}
          {data.pages.length > 0 && (
            <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <h2 className="text-sm font-medium text-neutral-300 mb-3">Pages</h2>
              <ul className="text-sm space-y-1">
                {data.pages.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="text-neutral-200">{p.name ?? p.id}</span>
                    {p.connectedInstagram && <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">IG</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Instagram */}
          {data.instagramAccounts.length > 0 && (
            <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <h2 className="text-sm font-medium text-neutral-300 mb-3">Instagram accounts</h2>
              <ul className="text-sm space-y-1">
                {data.instagramAccounts.map((ig) => (
                  <li key={ig.id} className="text-neutral-200">{ig.username ?? ig.id}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Pixels */}
          {data.pixels.length > 0 && (
            <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <h2 className="text-sm font-medium text-neutral-300 mb-3">Pixels</h2>
              <ul className="text-sm space-y-1">
                {data.pixels.map((px) => (
                  <li key={px.id} className="text-neutral-200">{px.name ?? px.id}</li>
                ))}
              </ul>
            </section>
          )}

          {/* WhatsApp */}
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300 mb-3">WhatsApp</h2>
            <p className="text-sm text-neutral-400">
              Status: <span className="text-neutral-200">{data.whatsapp.status}</span>
              {data.whatsapp.businesses && data.whatsapp.businesses.length > 0 && (
                <span className="ml-2">— {data.whatsapp.businesses.length} business account(s)</span>
              )}
            </p>
          </section>

          {data.errors && data.errors.length > 0 && (
            <section className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-4">
              <h2 className="text-sm font-medium text-amber-200 mb-2">Errors</h2>
              <ul className="text-sm text-neutral-400 list-disc list-inside space-y-0.5">
                {data.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
