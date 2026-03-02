"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  FileText,
  Settings,
  LayoutDashboard,
  LogOut,
  BarChart3,
  TrendingUp,
  Quote,
  FileCheck,
  Library,
  Menu,
  Activity,
  Target,
  Youtube,
  Megaphone,
  Rss,
  Calendar,
  Package,
  Layers,
  ChevronRight,
  Bell,
  Search,
  Zap,
  Sparkles,
  Wrench,
  Shield,
  Newspaper,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Sheet } from "@/components/ui/sheet";
import { InboxBadge } from "@/components/dashboard/InboxBadge";

/* ── Types ── */

type SidebarMode = "daily" | "full";
type NavItem = { href: string; label: string; icon: React.ElementType; group: string; dailyMode?: boolean };
type NavGroupMeta = { key: string; label: string; defaultOpen: boolean };
type SidebarCounts = { nba: number; risk: number; proposalsOverdue: number };

/* ── Constants ── */

const COUNT_MAP: Record<string, keyof SidebarCounts> = {
  "/dashboard/next-actions": "nba",
  "/dashboard/risk": "risk",
  "/dashboard/proposals": "proposalsOverdue",
};

const LIFECYCLE_GROUPS: NavGroupMeta[] = [
  { key: "capture",  label: "Capture",  defaultOpen: true },
  { key: "convert",  label: "Convert",  defaultOpen: true },
  { key: "build",    label: "Build",    defaultOpen: false },
  { key: "prove",    label: "Prove",    defaultOpen: false },
  { key: "optimize", label: "Optimize", defaultOpen: false },
  { key: "system",   label: "System",   defaultOpen: false },
];

const NAV_ITEMS: NavItem[] = [
  // CAPTURE
  { href: "/dashboard/intake",    label: "Lead Intake",  icon: Target,   group: "capture" },
  { href: "/dashboard/prospect",  label: "Prospect",     icon: Search,   group: "capture" },
  { href: "/dashboard/signals",   label: "Signals",      icon: Rss,      group: "capture" },
  { href: "/dashboard/growth",    label: "Growth",       icon: TrendingUp, group: "capture" },
  { href: "/dashboard/copilot",   label: "Copilot",      icon: Sparkles, group: "capture" },
  { href: "/dashboard/meta-ads",  label: "Meta Ads",     icon: Megaphone, group: "capture" },
  { href: "/dashboard/youtube",   label: "YouTube",      icon: Youtube,  group: "capture" },

  // CONVERT
  { href: "/dashboard/leads",      label: "Leads",       icon: Inbox,     group: "convert", dailyMode: true },
  { href: "/dashboard/proposals",  label: "Proposals",   icon: FileText,  group: "convert", dailyMode: true },
  { href: "/dashboard/followups",  label: "Follow-ups",  icon: Calendar,  group: "convert", dailyMode: true },
  { href: "/dashboard/forecast",   label: "Forecast",    icon: TrendingUp, group: "convert" },

  // BUILD
  { href: "/dashboard/delivery",  label: "Delivery",     icon: Package,  group: "build", dailyMode: true },
  { href: "/dashboard/handoffs",  label: "Handoffs",     icon: FileCheck, group: "build" },
  { href: "/dashboard/build-ops", label: "Build Ops",    icon: Wrench,   group: "build" },
  { href: "/dashboard/deploys",   label: "Deploys",      icon: Zap,      group: "build" },

  // PROVE
  { href: "/dashboard/proof",            label: "Proof",            icon: Quote,     group: "prove" },
  { href: "/dashboard/reviews",          label: "Reviews",          icon: FileCheck, group: "prove" },
  { href: "/dashboard/proof-candidates", label: "Proof Candidates", icon: FileCheck, group: "prove" },
  { href: "/dashboard/content-posts",   label: "Content Posts",    icon: Newspaper, group: "prove" },

  // OPTIMIZE
  { href: "/dashboard/conversion",         label: "Conversion",   icon: TrendingUp, group: "optimize" },
  { href: "/dashboard/retention",          label: "Retention",    icon: Target,     group: "optimize" },
  { href: "/dashboard/risk",              label: "Risk",         icon: Activity,   group: "optimize", dailyMode: true },
  { href: "/dashboard/intelligence",      label: "Intelligence", icon: BarChart3,  group: "optimize" },
  { href: "/dashboard/internal/scoreboard", label: "Scoreboard", icon: BarChart3,  group: "optimize" },

  // SYSTEM
  { href: "/dashboard/founder",              label: "Home",           icon: Target,   group: "system", dailyMode: true },
  { href: "/dashboard/next-actions",         label: "Next Actions",   icon: Zap,      group: "system", dailyMode: true },
  { href: "/dashboard/inbox",               label: "Inbox",          icon: Bell,     group: "system", dailyMode: true },
  { href: "/dashboard/reminders",           label: "Reminders",      icon: Calendar, group: "system" },
  { href: "/dashboard/founder/os",          label: "Founder OS",     icon: Layers,   group: "system" },
  { href: "/dashboard/knowledge",           label: "Knowledge",      icon: Library,  group: "system" },
  { href: "/dashboard/jobs",               label: "Jobs",           icon: Package,  group: "system" },
  { href: "/dashboard/automation",          label: "Automation",     icon: Activity, group: "system" },
  { href: "/dashboard/operator",           label: "Operator",       icon: Shield,   group: "system" },
  { href: "/dashboard/settings",           label: "Settings",       icon: Settings, group: "system" },
  { href: "/dashboard/notifications",      label: "Notifications",  icon: Bell,     group: "system" },
  { href: "/dashboard/notification-channels", label: "Channels",    icon: Bell,     group: "system" },
  { href: "/dashboard/flywheel",           label: "Flywheel",       icon: Zap,      group: "system" },
  { href: "/dashboard/system",             label: "Exec Metrics",   icon: BarChart3, group: "system" },
  { href: "/dashboard/ops-health",         label: "System Health",  icon: Activity, group: "system" },
  { href: "/dashboard/job-schedules",      label: "Job Schedules",  icon: Calendar, group: "system" },
];

const STORAGE_KEY = "sidebar-open-groups";
const SIDEBAR_MODE_KEY = "sidebar-mode";

/* ── Helpers ── */

function isItemActive(href: string, pathname: string): boolean {
  if (href === "/dashboard/overview") return pathname === "/dashboard/overview";
  if (href === "/dashboard/command") return pathname === "/dashboard/command";
  if (href === "/dashboard/leads") return pathname === "/dashboard/leads" || pathname.startsWith("/dashboard/leads/");
  if (href === "/dashboard/settings") return pathname.startsWith("/dashboard/settings");
  return pathname.startsWith(href);
}

/* ── NavContent ── */

function NavContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();

  // Mode state (daily / full)
  const [mode, setMode] = React.useState<SidebarMode>("daily");
  const [modeHydrated, setModeHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_MODE_KEY);
      if (stored === "daily" || stored === "full") setMode(stored);
    } catch {}
    setModeHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!modeHydrated) return;
    try { localStorage.setItem(SIDEBAR_MODE_KEY, mode); } catch {}
  }, [mode, modeHydrated]);

  // Group collapse state
  const defaultOpenState = React.useMemo(
    () => Object.fromEntries(LIFECYCLE_GROUPS.map((g) => [g.key, g.defaultOpen])),
    []
  );
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(defaultOpenState);
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups)); } catch {}
  }, [openGroups, hydrated]);

  // Auto-open the group containing the active page (full mode only)
  React.useEffect(() => {
    if (mode !== "full") return;
    for (const item of NAV_ITEMS) {
      if (isItemActive(item.href, pathname)) {
        setOpenGroups((prev) => (prev[item.group] ? prev : { ...prev, [item.group]: true }));
        break;
      }
    }
  }, [pathname, mode]);

  // Filter + search
  const [filter, setFilter] = React.useState("");
  const [counts, setCounts] = React.useState<SidebarCounts | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/sidebar-counts", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setCounts(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
      active ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
    );

  // Derive visible items from mode + search
  const lowerFilter = filter.toLowerCase();

  const visibleItems = React.useMemo(() => {
    const modeFiltered = mode === "daily" ? NAV_ITEMS.filter((i) => i.dailyMode) : NAV_ITEMS;
    return lowerFilter
      ? modeFiltered.filter((i) => i.label.toLowerCase().includes(lowerFilter))
      : modeFiltered;
  }, [mode, lowerFilter]);

  // Group items for full mode
  const groupedItems = React.useMemo(() => {
    if (mode === "daily") return null;
    const map = new Map<string, NavItem[]>();
    for (const item of visibleItems) {
      const arr = map.get(item.group) || [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return map;
  }, [mode, visibleItems]);

  function renderLink(item: NavItem) {
    const active = isItemActive(item.href, pathname);
    const countKey = COUNT_MAP[item.href];
    const count = countKey && counts ? counts[countKey] : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onLinkClick}
        className={linkClass(active)}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        {item.label}
        {count > 0 && (
          <span className="ml-auto text-[10px] font-medium leading-none px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
            {count}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-auto">
        {/* AI Brain — persistent top item */}
        <Link
          href="/dashboard/chat"
          onClick={onLinkClick}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-2",
            isItemActive("/dashboard/chat", pathname)
              ? "bg-amber-600/15 text-amber-400 border border-amber-600/20"
              : "text-amber-400/80 hover:bg-amber-600/10 hover:text-amber-400 border border-transparent"
          )}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          AI Brain
        </Link>

        {/* Mode toggle */}
        <div className="flex rounded-lg bg-neutral-900 border border-neutral-800 p-0.5 mx-1 mb-2">
          <button
            type="button"
            onClick={() => setMode("daily")}
            className={cn(
              "flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors",
              mode === "daily"
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setMode("full")}
            className={cn(
              "flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors",
              mode === "full"
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            Full
          </button>
        </div>

        {/* Quick filter */}
        <div className="relative px-1 pb-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Find a page..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 pl-8 pr-3 py-1.5 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
          />
        </div>

        {/* Daily mode — flat list */}
        {mode === "daily" && (
          <div className="space-y-0.5">
            {visibleItems.map(renderLink)}
          </div>
        )}

        {/* Full mode — lifecycle groups */}
        {mode === "full" && LIFECYCLE_GROUPS.map((group) => {
          const items = groupedItems?.get(group.key) || [];
          if (items.length === 0) return null;
          const isOpen = lowerFilter ? true : openGroups[group.key] ?? group.defaultOpen;
          const hasActive = items.some((item) => isItemActive(item.href, pathname));

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
                  {items.map(renderLink)}
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
