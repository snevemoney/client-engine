import { prisma } from "@/lib/db";
import { getTheme } from "@/lib/themes";

type Section = { type: string; props: Record<string, unknown> };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white">Site not found</div>;

  const sections = JSON.parse(site.sections || "[]") as Section[];
  const storedColors = site.themeColorsJson ? (JSON.parse(site.themeColorsJson) as string[]) : null;
  const theme = getTheme(site.industry, storedColors);
  const themeColors = { primary: theme.primary, heroFrom: theme.heroFrom, heroTo: theme.heroTo, accent: theme.accent };
  const hero = sections.find((s) => s.type === "hero" || s.type === "homepage");
  const heroProps = (hero?.props ?? {}) as Record<string, string>;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        // @ts-expect-error CSS vars
        "--color-primary": themeColors.primary,
        "--color-hero-from": themeColors.heroFrom,
        "--color-hero-to": themeColors.heroTo,
        "--color-accent": themeColors.accent,
      }}
    >
      <style>{`
        .hero-gradient { background: linear-gradient(180deg, var(--color-hero-from) 0%, var(--color-hero-to) 100%); }
        .btn-primary { background: var(--color-primary); }
        .btn-primary:hover { filter: brightness(1.1); }
      `}</style>
      <header className="hero-gradient py-24 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 max-w-3xl mx-auto">
          {heroProps.headline ?? "Welcome"}
        </h1>
        <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
          {heroProps.subhead ?? ""}
        </p>
        <a
          href={(heroProps.ctaLink as string) ?? "#about"}
          className="inline-block px-8 py-4 rounded-lg btn-primary font-semibold text-white no-underline"
        >
          {heroProps.ctaText ?? "Get Started"}
        </a>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-16 text-neutral-800">
        {sections
          .filter((s) => s.type !== "hero" && s.type !== "homepage")
          .map((s, i) => (
            <section key={i} className="mb-12">
              <h2 className="text-2xl font-semibold mb-4" style={{ color: themeColors.primary }}>
                {(s.props as Record<string, string>).title ?? s.type}
              </h2>
              <p className="text-neutral-600">{(s.props as Record<string, string>).body ?? ""}</p>
            </section>
          ))}
      </main>
    </div>
  );
}
