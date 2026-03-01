"use client";

import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useBrainPanel } from "@/contexts/BrainPanelContext";

export function BrainFloatingButton() {
  const { toggle, isOpen } = useBrainPanel();
  const pathname = usePathname();

  // Hide on the full Brain chat page
  if (pathname === "/dashboard/chat") return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isOpen ? "Close AI Brain" : "Open AI Brain"}
      title="⌘K"
      className={`fixed bottom-6 right-6 z-30 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-200 bg-amber-600/90 hover:bg-amber-500 text-white md:bottom-8 md:right-8 ${
        isOpen ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100"
      }`}
    >
      <Sparkles className="w-6 h-6" />
    </button>
  );
}
