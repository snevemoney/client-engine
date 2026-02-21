"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  FileText,
  Rocket,
  Settings,
  LayoutDashboard,
  LogOut,
  BarChart3,
  TrendingUp,
  Quote,
  ClipboardList,
} from "lucide-react";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Leads", icon: Inbox },
  { href: "/dashboard/proposals", label: "Proposals", icon: FileText },
  { href: "/dashboard/proof", label: "Proof", icon: Quote },
  { href: "/dashboard/checklist", label: "Checklist", icon: ClipboardList },
  { href: "/dashboard/deploys", label: "Deploys", icon: Rocket },
  { href: "/dashboard/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/dashboard/conversion", label: "Conversion", icon: TrendingUp },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-neutral-800 bg-neutral-950 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-neutral-800">
        <Link href="/" className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-neutral-400" />
          <span className="font-semibold text-sm tracking-tight">Client Engine</span>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard" || pathname.startsWith("/dashboard/leads")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-neutral-800">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
