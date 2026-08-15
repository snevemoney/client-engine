import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { SiteLink } from "./SiteLink";

type LegalPageProps = {
  title: string;
  description: string;
  lastUpdated?: string;
  children: React.ReactNode;
};

export function LegalPage({ title, description, lastUpdated, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <SiteLink
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Home
        </SiteLink>
        <h1 className="text-3xl font-light tracking-tight mb-4">{title}</h1>
        <p className="text-neutral-400 leading-relaxed mb-2">{description}</p>
        {lastUpdated && (
          <p className="text-sm text-neutral-500 mb-10">Last updated: {lastUpdated}</p>
        )}
        {!lastUpdated && <div className="mb-10" />}
        <article className="space-y-10">{children}</article>
      </main>

      <SiteFooter />
    </div>
  );
}

type LegalSectionProps = {
  title: string;
  id?: string;
  children: React.ReactNode;
};

export function LegalSection({ title, id, children }: LegalSectionProps) {
  return (
    <section id={id} className="space-y-4">
      <h2 className="text-xl font-medium text-neutral-200">{title}</h2>
      <div className="space-y-4 text-neutral-400 leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:text-neutral-300 [&_a]:hover:text-white [&_a]:underline [&_strong]:text-neutral-200">
        {children}
      </div>
    </section>
  );
}
