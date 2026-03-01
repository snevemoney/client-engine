"use client";

import { usePathname } from "next/navigation";
import { useBrainPanel } from "@/contexts/BrainPanelContext";
import { BrainChatCore } from "./BrainChatCore";

export function BrainSlideOver() {
  const { isOpen, close, pageContext, pageData } = useBrainPanel();
  const pathname = usePathname();

  // Don't mount chat core when on the full Brain page (avoid duplicate hook instances)
  const shouldRenderChat = pathname !== "/dashboard/chat";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-neutral-950 border-l border-neutral-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="AI Brain chat"
      >
        {shouldRenderChat && isOpen && (
          <BrainChatCore mode="panel" pageContext={pageContext} pageData={pageData} onClose={close} />
        )}
      </div>
    </>
  );
}
