import { SiteLink } from "@/components/site/SiteLink";

type SiteFooterProps = { className?: string };

export function SiteFooter({ className = "" }: SiteFooterProps) {
  return (
    <footer className={`border-t border-neutral-800/50 py-8 ${className}`.trim()}>
      <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm text-neutral-500">&copy; {new Date().getFullYear()} Evens Louis</span>
        <div className="flex items-center gap-6 text-sm text-neutral-500">
          <SiteLink href="/services" className="hover:text-neutral-300 transition-colors">
            Services
          </SiteLink>
          <SiteLink href="/work" className="hover:text-neutral-300 transition-colors">
            Work
          </SiteLink>
          <SiteLink href="/contact" className="hover:text-neutral-300 transition-colors">
            Contact
          </SiteLink>
          <SiteLink href="/privacy" className="hover:text-neutral-300 transition-colors">
            Privacy
          </SiteLink>
          <SiteLink href="/terms" className="hover:text-neutral-300 transition-colors">
            Terms
          </SiteLink>
          <SiteLink href="/data-deletion" className="hover:text-neutral-300 transition-colors">
            Data Deletion
          </SiteLink>
          <a href="mailto:contact@evenslouis.ca" className="hover:text-neutral-300 transition-colors">
            Email
          </a>
        </div>
      </div>
    </footer>
  );
}
