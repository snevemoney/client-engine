import Link from "next/link";
import { ArrowRight, Zap, Code2, Rocket, Shield, Monitor, Bot } from "lucide-react";
import { db } from "@/lib/db";
import { LeadCaptureForm } from "@/components/site/LeadCaptureForm";

export const dynamic = "force-dynamic";

async function getFeaturedProjects() {
  try {
    return await db.project.findMany({
      where: { status: "live" },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
  } catch {
    return [];
  }
}

const services = [
  {
    icon: Code2,
    title: "Full-Stack Development",
    description: "Next.js, React, Node.js, PostgreSQL — modern stacks built for performance and scale.",
  },
  {
    icon: Bot,
    title: "AI Integrations",
    description: "OpenAI, LangChain, custom agents — turn AI into a real feature, not a gimmick.",
  },
  {
    icon: Zap,
    title: "Automation Systems",
    description: "Workflows that eliminate repetitive tasks. Data pipelines, notifications, scheduling.",
  },
  {
    icon: Rocket,
    title: "MVP & Rapid Prototyping",
    description: "From idea to deployed demo in days, not months. Validated before you invest further.",
  },
  {
    icon: Monitor,
    title: "Dashboards & Internal Tools",
    description: "Admin panels, analytics dashboards, CRMs — tools your team actually uses.",
  },
  {
    icon: Shield,
    title: "DevOps & Deployment",
    description: "Docker, VPS, CI/CD — your app runs on infrastructure you own, not a platform you rent.",
  },
];

const processSteps = [
  { step: "01", title: "Discovery", description: "We define scope, timeline, and success criteria in a focused call." },
  { step: "02", title: "Build", description: "I build in short cycles with daily updates. You see progress, not just promises." },
  { step: "03", title: "Ship", description: "Deployed, documented, and handed off — or maintained long-term if you prefer." },
];

export default async function HomePage() {
  const projects = await getFeaturedProjects();

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      {/* Nav */}
      <header className="border-b border-neutral-800/50 backdrop-blur-sm sticky top-0 z-50 bg-neutral-950/80">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">evenslouis</Link>
          <nav className="flex items-center gap-6 text-sm text-neutral-400">
            <a href="#services" className="hover:text-neutral-100 transition-colors">Services</a>
            <Link href="/work" className="hover:text-neutral-100 transition-colors">Work</Link>
            <a href="#contact" className="hover:text-neutral-100 transition-colors">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-shrink-0 flex items-center justify-center px-6 pt-24 pb-32">
        <div className="max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 bg-neutral-800/50 border border-neutral-700/50 rounded-full px-4 py-1.5 text-xs text-neutral-400 mb-8">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Available for new projects
          </div>
          <h1 className="text-5xl sm:text-6xl font-light tracking-tight leading-[1.1] mb-6">
            I build software that<br />
            <span className="text-white font-normal">runs your business.</span>
          </h1>
          <p className="text-neutral-400 text-lg sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Full-stack development, automation, and AI — shipped fast on infrastructure you own.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/work"
              className="inline-flex items-center gap-2 bg-white text-neutral-900 px-7 py-3 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors"
            >
              View my work <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 border border-neutral-700 px-7 py-3 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Start a project
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="border-t border-neutral-800/50 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-sm text-neutral-500 uppercase tracking-widest mb-3">What I do</p>
            <h2 className="text-3xl font-light tracking-tight">
              End-to-end development, <span className="text-white font-normal">your way.</span>
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.title} className="border border-neutral-800/50 rounded-xl p-6 hover:border-neutral-700/50 transition-colors group">
                <s.icon className="w-5 h-5 text-neutral-500 group-hover:text-neutral-300 transition-colors mb-4" />
                <h3 className="font-medium mb-2">{s.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Projects */}
      {projects.length > 0 && (
        <section className="border-t border-neutral-800/50 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-sm text-neutral-500 uppercase tracking-widest mb-3">Recent work</p>
                <h2 className="text-3xl font-light tracking-tight">Selected projects</h2>
              </div>
              <Link href="/work" className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors inline-flex items-center gap-1">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/work/${p.slug}`}
                  className="border border-neutral-800/50 rounded-xl p-6 hover:border-neutral-700/50 transition-colors group"
                >
                  <h3 className="font-medium mb-2 group-hover:text-white transition-colors">{p.name}</h3>
                  <p className="text-sm text-neutral-400 line-clamp-2">{p.description}</p>
                  {p.demoUrl && (
                    <span className="inline-block mt-3 text-xs text-emerald-400">Live demo available</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Process */}
      <section className="border-t border-neutral-800/50 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-sm text-neutral-500 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl font-light tracking-tight">
              Simple process, <span className="text-white font-normal">real results.</span>
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3 max-w-4xl mx-auto">
            {processSteps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-3xl font-light text-neutral-700 mb-4">{s.step}</div>
                <h3 className="font-medium mb-2">{s.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="border-t border-neutral-800/50 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm text-neutral-500 uppercase tracking-widest mb-3">About</p>
          <h2 className="text-3xl font-light tracking-tight mb-6">
            Hi, I&apos;m <span className="text-white font-normal">Evens.</span>
          </h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            I&apos;m a full-stack developer specializing in web applications, automation systems, and AI integrations.
            I work with startups and businesses who need software that actually ships — on time, on budget, on infrastructure they control.
          </p>
          <p className="text-neutral-400 leading-relaxed">
            Every project I take on gets my full attention. No outsourcing, no hand-offs. You work directly with me from day one through deployment.
          </p>
        </div>
      </section>

      {/* CTA / Contact */}
      <section id="contact" className="border-t border-neutral-800/50 px-6 py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-light tracking-tight mb-4 text-center">
            Ready to <span className="text-white font-normal">build something?</span>
          </h2>
          <p className="text-neutral-400 mb-8 text-center">
            Tell me about your project. I&apos;ll respond within 24 hours with a plan and timeline.
          </p>
          <LeadCaptureForm className="max-w-md mx-auto" />
          <p className="text-center mt-4 text-sm text-neutral-500">
            Or email <a href="mailto:contact@evenslouis.ca" className="text-neutral-400 hover:text-white">contact@evenslouis.ca</a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800/50 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-neutral-500">&copy; {new Date().getFullYear()} Evens Louis</span>
          <div className="flex items-center gap-6 text-sm text-neutral-500">
            <Link href="/work" className="hover:text-neutral-300 transition-colors">Work</Link>
            <a href="mailto:contact@evenslouis.ca" className="hover:text-neutral-300 transition-colors">Email</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
