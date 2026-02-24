import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Inbox, FileText, TrendingUp, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cards = [
    { href: "/dashboard/leads", label: "Leads", icon: Inbox, desc: "Pipeline, scoring, follow-ups" },
    { href: "/dashboard/proposals", label: "Proposals", icon: FileText, desc: "Positioning, send, track" },
    { href: "/dashboard/sales-leak", label: "Sales Leak", icon: TrendingUp, desc: "Identify drop-off and friction" },
    { href: "/dashboard/results", label: "Results Ledger", icon: Target, desc: "Proof, outcomes, reusable assets" },
  ];

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales System</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Build a repeatable sales engine. Identify your selling style, optimize your flow, and track performance.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 hover:border-neutral-600 hover:bg-neutral-800/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-neutral-800 p-2">
                <c.icon className="w-5 h-5 text-neutral-400" />
              </div>
              <div>
                <h3 className="font-medium text-neutral-200">{c.label}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{c.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <section className="rounded-lg border border-neutral-800 p-4 text-sm text-neutral-500">
        <p>
          <strong className="text-neutral-400">Outcome:</strong> A sales process you can follow, measure, and improve.
        </p>
      </section>
    </div>
  );
}
