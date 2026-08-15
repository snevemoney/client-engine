import { ArrowLeft, ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ServicesGrid } from "@/components/site/ServicesGrid";
import { SiteLink } from "@/components/site/SiteLink";

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <SiteHeader active="services" />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <SiteLink
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Home
        </SiteLink>
        <div className="text-center mb-16">
          <p className="text-sm text-neutral-500 uppercase tracking-widest mb-3">What I do</p>
          <h1 className="text-3xl font-light tracking-tight">
            End-to-end development, <span className="text-white font-normal">your way.</span>
          </h1>
        </div>
        <ServicesGrid />
        <div className="mt-16 text-center">
          <SiteLink
            href="/contact"
            className="inline-flex items-center gap-2 bg-white text-neutral-900 px-7 py-3 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors"
          >
            Start a project <ArrowRight className="w-4 h-4" />
          </SiteLink>
        </div>
      </main>

      <SiteFooter className="mt-12" />
    </div>
  );
}
