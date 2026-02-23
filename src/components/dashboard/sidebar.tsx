"use client";

import * as React from "react";
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
  Briefcase,
  MessageSquare,
  BookOpen,
  Library,
  Menu,
  Wrench,
  Activity,
  Target,
  Youtube,
  Megaphone,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Sheet } from "@/components/ui/sheet";

const primaryNav = [
  { href: "/dashboard/command", label: "Command Center", icon: LayoutDashboard },
  { href: "/dashboard/ops-health", label: "Ops Health", icon: Activity },
  { href: "/dashboard/sales-leak", label: "Sales Leak", icon: TrendingUp },
  { href: "/dashboard/results", label: "Results Ledger", icon: Target },
  { href: "/dashboard/leads", label: "Leads", icon: Inbox },
  { href: "/dashboard/proposals", label: "Proposals", icon: FileText },
  { href: "/dashboard/build-ops", label: "Build Ops", icon: Wrench },
  { href: "/dashboard/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/work", label: "Website / Work", icon: Briefcase },
  { href: "/dashboard/chat", label: "Chatbot", icon: MessageSquare },
  { href: "/dashboard/youtube", label: "YouTube Ingest", icon: Youtube },
  { href: "/dashboard/learning", label: "Learning", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const secondaryNav = [
  { href: "/dashboard/proof", label: "Proof", icon: Quote },
  { href: "/dashboard/checklist", label: "Checklist", icon: ClipboardList },
  { href: "/dashboard/deploys", label: "Deploys", icon: Rocket },
  { href: "/dashboard/conversion", label: "Conversion", icon: TrendingUp },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: Library },
  { href: "/dashboard/meta-ads", label: "Meta Ads", icon: Megaphone },
];

function NavContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
      active ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
    );

  return (
    <>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-auto">
        <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider px-3 py-1">Main</div>
        {primaryNav.map((item) => {
          const active =
            item.href === "/dashboard/command"
              ? pathname === "/dashboard/command"
              : item.href === "/dashboard/leads"
                ? pathname === "/dashboard/leads" || pathname.startsWith("/dashboard/leads/")
                : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={linkClass(!!active)}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider px-3 py-1 mt-2">More</div>
        {secondaryNav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={linkClass(active)}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 py-3 border-t border-neutral-800">
        <button
          onClick={() => {
            onLinkClick?.();
            signOut({ callbackUrl: "/" });
          }}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const [sheetOpen, setSheetOpen] = React.useState(false);

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden md:flex w-56 border-r border-neutral-800 bg-neutral-950 flex-col h-screen sticky top-0 shrink-0">
        <div className="px-4 py-4 border-b border-neutral-800">
          <Link href="/" className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-neutral-400" />
            <span className="font-semibold text-sm tracking-tight">Client Engine</span>
          </Link>
        </div>
        <NavContent />
      </aside>

      {/* Mobile: top bar + hamburger */}
      <header className="md:hidden sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-4 shrink-0">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setSheetOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="font-semibold text-sm tracking-tight text-neutral-200">
          Client Engine
        </Link>
      </header>

      {/* Mobile: slide-out nav drawer */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} side="left">
        <div className="flex flex-col h-full">
          <div className="flex h-14 items-center gap-2 border-b border-neutral-800 px-4">
            <span className="font-semibold text-sm tracking-tight text-neutral-200">Client Engine</span>
          </div>
          <NavContent onLinkClick={() => setSheetOpen(false)} />
        </div>
      </Sheet>
    </>
  );
}
