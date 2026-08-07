import { getBasePath } from "@/lib/base-path";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrainPanelProvider } from "@/contexts/BrainPanelContext";
import { BrainSlideOver } from "@/components/dashboard/brain/BrainSlideOver";
import { BrainFloatingButton } from "@/components/dashboard/brain/BrainFloatingButton";
import { IntelligenceBannerGlobal } from "@/components/dashboard/IntelligenceBannerGlobal";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    // next/navigation redirect() already applies basePath.
    redirect("/login");
  }

  const authBasePath = `${getBasePath()}/api/auth`;

  return (
    <SessionProvider session={session} basePath={authBasePath}>
      <BrainPanelProvider>
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1 p-4 md:p-6 overflow-auto">
            <IntelligenceBannerGlobal />
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
        <BrainSlideOver />
        <BrainFloatingButton />
      </BrainPanelProvider>
    </SessionProvider>
  );
}
