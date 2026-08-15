import { SiteLink } from "@/components/site/SiteLink";

type NavKey = "services" | "work" | "contact";

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "services", href: "/services", label: "Services" },
  { key: "work", href: "/work", label: "Work" },
  { key: "contact", href: "/contact", label: "Contact" },
];

export function SiteHeader({ active }: { active?: NavKey }) {
  return (
    <header className="border-b border-neutral-800/50 backdrop-blur-sm sticky top-0 z-50 bg-neutral-950/80">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
        <SiteLink href="/" className="text-lg font-semibold tracking-tight">
          evenslouis
        </SiteLink>
        <nav className="flex items-center gap-6 text-sm text-neutral-400">
          {NAV.map((item) => (
            <SiteLink
              key={item.key}
              href={item.href}
              className={
                active === item.key
                  ? "text-neutral-100"
                  : "hover:text-neutral-100 transition-colors"
              }
            >
              {item.label}
            </SiteLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
