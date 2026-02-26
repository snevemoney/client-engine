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
  ClipboardCheck,
  ClipboardList,
  FileCheck,
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
  Compass,
  Rss,
  Users,
  Calendar,
  Package,
  Award,
  Layers,
  ChevronRight,
  Bell,
  Search,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Sheet } from "@/components/ui/sheet";
import { InboxBadge } from "@/components/dashboard/InboxBadge";

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = {
  key: string;
  label: string;
  defaultOpen: boolean;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    key: "today",
    label: "Today",
    defaultOpen: true,
    items: [
      { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/command", label: "Dashboard", icon: Target },
      { href: "/dashboard/command-center", label: "Daily Summary", icon: LayoutDashboard },
      { href: "/dashboard/leads", label: "Leads", icon: Inbox },
      { href: "/dashboard/followups", label: "Follow-ups", icon: Calendar },
      { href: "/dashboard/proposals", label: "Proposals", icon: FileText },
      { href: "/dashboard/inbox", label: "Inbox", icon: Bell },
      { href: "/dashboard/next-actions", label: "Next Actions", icon: Target },
      { href: "/dashboard/chat", label: "Chat", icon: MessageSquare },
    ],
  },
  {
    key: "pipeline",
    label: "Pipeline",
    defaultOpen: false,
    items: [
      { href: "/dashboard/intake", label: "Lead Intake", icon: Target },
      { href: "/dashboard/proposal-followups", label: "Proposal Follow-ups", icon: Calendar },
      { href: "/dashboard/delivery", label: "Delivery", icon: Package },
      { href: "/dashboard/handoffs", label: "Handoffs", icon: FileCheck },
      { href: "/dashboard/retention", label: "Retention", icon: Target },
      { href: "/dashboard/reminders", label: "Reminders", icon: Calendar },
      { href: "/dashboard/risk", label: "Risk", icon: Activity },
    ],
  },
  {
    key: "numbers",
    label: "Numbers",
    defaultOpen: false,
    items: [
      { href: "/dashboard/sales", label: "Sales", icon: TrendingUp },
      { href: "/dashboard/forecast", label: "Forecast", icon: TrendingUp },
      { href: "/dashboard/intelligence", label: "Intelligence", icon: BarChart3 },
      { href: "/dashboard/scoreboard", label: "Scoreboard", icon: Target },
      { href: "/dashboard/results", label: "Results", icon: Target },
      { href: "/dashboard/operator", label: "Operator Score", icon: Award },
      { href: "/dashboard/sales-leak", label: "Sales Leak", icon: TrendingUp },
      { href: "/dashboard/conversion", label: "Conversion", icon: TrendingUp },
    ],
  },
  {
    key: "business",
    label: "Business",
    defaultOpen: false,
    items: [
      { href: "/dashboard/strategy", label: "Strategy", icon: Compass },
      { href: "/dashboard/planning", label: "Planning", icon: Calendar },
      { href: "/dashboard/team", label: "Team", icon: Users },
      { href: "/dashboard/reviews", label: "Reviews", icon: ClipboardCheck },
      { href: "/dashboard/grow", label: "GROW", icon: Target },
      { href: "/work", label: "Website", icon: Briefcase },
    ],
  },
  {
    key: "content",
    label: "Content & Learning",
    defaultOpen: false,
    items: [
      { href: "/dashboard/signals", label: "Signals", icon: Rss },
      { href: "/dashboard/meta-ads", label: "Meta Ads", icon: Megaphone },
      { href: "/dashboard/youtube", label: "YouTube", icon: Youtube },
      { href: "/dashboard/knowledge", label: "Knowledge", icon: Library },
      { href: "/dashboard/learning", label: "Learning", icon: BookOpen },
      { href: "/dashboard/proof", label: "Proof", icon: Quote },
      { href: "/dashboard/proof-candidates", label: "Proof Candidates", icon: FileCheck },
    ],
  },
  {
    key: "system",
    label: "System",
    defaultOpen: false,
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
      { href: "/dashboard/automation", label: "Automation", icon: Activity },
      { href: "/dashboard/notifications", label: "Alert History", icon: Activity },
      { href: "/dashboard/notification-channels", label: "Channels", icon: Layers },
      { href: "/dashboard/jobs", label: "Jobs", icon: Layers },
      { href: "/dashboard/job-schedules", label: "Schedules", icon: Calendar },
      { href: "/dashboard/ops-health", label: "System Health", icon: Activity },
      { href: "/dashboard/build-ops", label: "Build Tracker", icon: Wrench },
      { href: "/dashboard/metrics", label: "Metrics", icon: BarChart3 },
      { href: "/dashboard/deploys", label: "Deploys", icon: Rocket },
      { href: "/dashboard/checklist", label: "Checklist", icon: ClipboardList },
    ],
  },
  {
    key: "advanced",
    label: "Advanced",
    defaultOpen: false,
    items: [
      { href: "/dashboard/audit", label: "Audit", icon: FileCheck },
      { href: "/dashboard/observability", label: "Monitoring", icon: Eye },
      { href: "/dashboard/internal/scoreboard", label: "Operational Scores", icon: BarChart3 },
      { href: "/dashboard/internal/scores/alerts", label: "Score Alerts", icon: Activity },
      { href: "/dashboard/internal/qa/notifications", label: "QA: Notifications", icon: ShieldCheck },
      { href: "/dashboard/internal/qa/scores", label: "QA: Scores", icon: BarChart3 },
      { href: "/dashboard/internal/qa/risk", label: "QA: Risk", icon: ShieldCheck },
      { href: "/dashboard/internal/qa/next-actions", label: "QA: Next Actions", icon: Target },
    ],
  },
];

const STORAGE_KEY = "sidebar-open-groups";


function isItemActive(href: string, pathname: string): boolean {
  if (href === "/dashboard/overview") return pathname === "/dashboard/overview";
  if (href === "/dashboard/command") return pathname === "/dashboard/command";
  if (href === "/dashboard/leads") return pathname === "/dashboard/leads" || pathname.startsWith("/dashboard/leads/");
  if (href === "/dashboard/settings") return pathname.startsWith("/dashboard/settings");
  return pathname.startsWith(href);
}

function NavContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();
  const defaultOpen = React.useMemo(
    () => Object.fromEntries(navGroups.map((g) => [g.key, g.defaultOpen])),
    []
  );
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(defaultOpen);
  const [filter, setFilter] = React.useState("");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setOpenGroups(JSON.parse(stored));
    } catch {}
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {}
  }, [openGroups, hydrated]);

  // Auto-open the group that contains the active page
  React.useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some((item) => isItemActive(item.href, pathname))) {
        setOpenGroups((prev) => (prev[group.key] ? prev : { ...prev, [group.key]: true }));
        break;
      }
    }
  }, [pathname]);

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
      active ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
    );

  const lowerFilter = filter.toLowerCase();
  const filteredGroups = lowerFilter
    ? navGroups
        .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(lowerFilter)) }))
        .filter((g) => g.items.length > 0)
    : navGroups;

  return (
    <>
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-auto">
        {/* Quick filter */}
        <div className="relative px-1 pb-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Find a page…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 pl-8 pr-3 py-1.5 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
          />
        </div>

        {filteredGroups.map((group) => {
          const isOpen = lowerFilter ? true : openGroups[group.key] ?? group.defaultOpen;
          const hasActive = group.items.some((item) => isItemActive(item.href, pathname));

          return (
            <div key={group.key} className="mb-1">
              <button
                type="button"
                onClick={() => !lowerFilter && toggleGroup(group.key)}
                className={cn(
                  "flex items-center w-full gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded-md transition-colors",
                  hasActive ? "text-neutral-200" : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                <ChevronRight
                  className={cn(
                    "w-3 h-3 shrink-0 transition-transform duration-150",
                    isOpen && "rotate-90"
                  )}
                />
                {group.label}
                {!isOpen && hasActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-neutral-400" />
                )}
              </button>
              {isOpen && (
                <div className="space-y-0.5 mt-0.5">
                  {group.items.map((item) => {
                    const active = isItemActive(item.href, pathname);
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
                </div>
              )}
            </div>
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
      <aside className="hidden md:flex w-56 border-r border-neutral-800 bg-neutral-950 flex-col h-screen sticky top-0 shrink-0">
        <div className="px-4 py-4 border-b border-neutral-800 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-neutral-400" />
            <span className="font-semibold text-sm tracking-tight">Client Engine</span>
          </Link>
          <InboxBadge />
        </div>
        <NavContent />
      </aside>

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
