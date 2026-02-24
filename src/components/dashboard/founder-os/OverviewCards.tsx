"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  TrendingUp,
  Compass,
  Users,
  Target,
  Calendar,
  ClipboardCheck,
  BarChart3,
  Settings,
} from "lucide-react";

const SECTIONS = [
  { href: "/dashboard/command", label: "Command Center", icon: LayoutDashboard, desc: "Daily ops at a glance" },
  { href: "/dashboard/sales", label: "Sales System", icon: TrendingUp, desc: "Leads, proposals, pipeline" },
  { href: "/dashboard/strategy", label: "Strategy", icon: Compass, desc: "Weekly strategy & campaign" },
  { href: "/dashboard/team", label: "Team & Leadership", icon: Users, desc: "Build the right team" },
  { href: "/dashboard/grow", label: "GROW", icon: Target, desc: "Growth engine & frameworks" },
  { href: "/dashboard/planning", label: "Planning", icon: Calendar, desc: "Themes, targets, execution" },
  { href: "/dashboard/reviews", label: "Reviews", icon: ClipboardCheck, desc: "Weekly review rhythm" },
  { href: "/dashboard/scoreboard", label: "Scoreboard", icon: BarChart3, desc: "Execution at a glance" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, desc: "Integrations & config" },
];

export function OverviewCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 hover:border-neutral-600 hover:bg-neutral-800/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-neutral-800 p-2">
              <s.icon className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-neutral-200">{s.label}</h3>
              <p className="text-xs text-neutral-500 mt-0.5">{s.desc}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
