"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

interface BrainPanelContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  pageContext: string;
  pageData: string | null;
  setPageData: (data: string | null) => void;
}

const BrainPanelContext = createContext<BrainPanelContextValue | null>(null);

const PAGE_LABELS: Record<string, string> = {
  "/dashboard/founder": "the Founder dashboard",
  "/dashboard/leads": "the Leads pipeline",
  "/dashboard/followups": "the Follow-ups page",
  "/dashboard/proposals": "the Proposals page",
  "/dashboard/inbox": "the Inbox",
  "/dashboard/reviews": "the Reviews page",
  "/dashboard/delivery": "the Delivery projects page",
  "/dashboard/prospect": "the Prospect page",
  "/dashboard/intake": "the Lead Intake page",
  "/dashboard/handoffs": "the Handoffs page",
  "/dashboard/growth": "the Growth pipeline",
  "/dashboard/risk": "the Risk dashboard",
  "/dashboard/forecast": "the Revenue Forecast",
  "/dashboard/retention": "the Retention page",
  "/dashboard/next-actions": "the Next Actions page",
  "/dashboard/proof": "the Proof page",
  "/dashboard/flywheel": "the Flywheel page",
  "/dashboard/operator": "the Operator page",
  "/dashboard/operator/agents": "the Agents dashboard",
  "/dashboard/settings": "the Settings page",
  "/dashboard/command": "the Command Center",
  "/dashboard/internal/scoreboard": "the Operational Scoreboard",
  "/dashboard/signals": "the Signal Engine",
  "/dashboard/intelligence": "the Intelligence dashboard",
  "/dashboard/conversion": "the Conversion page",
  "/dashboard/automation": "the Automation page",
  "/dashboard/jobs": "the Jobs page",
  "/dashboard/job-schedules": "the Job Schedules page",
  "/dashboard/notifications": "the Notifications page",
  "/dashboard/notification-channels": "the Notification Channels page",
  "/dashboard/proof-candidates": "the Proof Candidates page",
  "/dashboard/reminders": "the Reminders page",
  "/dashboard/copilot": "the Copilot page",
  "/dashboard/copilot/sessions": "the Copilot Sessions page",
  "/dashboard/strategy": "the Strategy page",
  "/dashboard/youtube": "the YouTube Ingest page",
  "/dashboard/knowledge": "the Knowledge Base page",
  "/dashboard/learning": "the Learning page",
  "/dashboard/build-ops": "the Build Ops page",
  "/dashboard/meta-ads": "the Meta Ads Monitor",
  "/dashboard/system": "the System Performance page",
  "/dashboard/content-posts": "the Content Posts page",
  "/dashboard/proposal-followups": "the Proposal Follow-ups page",
};

function describePageContext(pathname: string): string {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  if (pathname.startsWith("/dashboard/leads/")) return `a lead detail page (${pathname})`;
  if (pathname.startsWith("/dashboard/proposals/")) return `a proposal detail page (${pathname})`;
  if (pathname.startsWith("/dashboard/delivery/")) return `a delivery project (${pathname})`;
  if (pathname.startsWith("/dashboard/intake/")) return `an intake lead (${pathname})`;
  return pathname;
}

export function BrainPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pageData, setPageData] = useState<string | null>(null);
  const pathname = usePathname();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const pageContext = describePageContext(pathname);

  // Clear stale page data on navigation
  useEffect(() => {
    setPageData(null);
  }, [pathname]);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Lock body scroll on mobile when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <BrainPanelContext.Provider value={{ isOpen, open, close, toggle, pageContext, pageData, setPageData }}>
      {children}
    </BrainPanelContext.Provider>
  );
}

export function useBrainPanel(): BrainPanelContextValue {
  const ctx = useContext(BrainPanelContext);
  if (!ctx) throw new Error("useBrainPanel must be used within BrainPanelProvider");
  return ctx;
}
