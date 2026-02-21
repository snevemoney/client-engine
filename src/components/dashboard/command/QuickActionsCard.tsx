import Link from "next/link";
import { FileText, Inbox, BarChart3, Rocket } from "lucide-react";

export function QuickActionsCard() {
  const actions = [
    { href: "/dashboard/proposals", label: "Approve / send proposal", icon: FileText },
    { href: "/dashboard/leads", label: "Approve top leads", icon: Inbox },
    { href: "/dashboard/metrics", label: "Metrics / retry failed", icon: BarChart3 },
    { href: "/dashboard/deploys", label: "Deploys", icon: Rocket },
  ];

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Quick actions</h2>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
