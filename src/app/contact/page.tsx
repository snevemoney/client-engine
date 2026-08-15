import { ArrowLeft } from "lucide-react";
import { LeadCaptureForm } from "@/components/site/LeadCaptureForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteLink } from "@/components/site/SiteLink";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <SiteHeader active="contact" />

      <main className="mx-auto max-w-2xl px-6 py-12">
        <SiteLink
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Home
        </SiteLink>
        <h1 className="text-3xl font-light tracking-tight mb-4 text-center">
          Ready to <span className="text-white font-normal">build something?</span>
        </h1>
        <p className="text-neutral-400 mb-8 text-center">
          Tell me about your project. I&apos;ll respond within 24 hours with a plan and timeline.
        </p>
        <LeadCaptureForm className="max-w-md mx-auto" />
        <p className="text-center mt-4 text-sm text-neutral-500">
          Or email{" "}
          <a href="mailto:contact@evenslouis.ca" className="text-neutral-400 hover:text-white">
            contact@evenslouis.ca
          </a>
        </p>
      </main>

      <SiteFooter className="mt-12" />
    </div>
  );
}
