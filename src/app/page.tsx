import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-800">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">evenslouis</span>
          <nav className="flex items-center gap-6 text-sm text-neutral-400">
            <Link href="/work" className="hover:text-neutral-100 transition-colors">Work</Link>
            <Link href="/dashboard" className="hover:text-neutral-100 transition-colors">Dashboard</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-5xl font-light tracking-tight leading-tight mb-6">
            I build software that<br />
            <span className="text-white font-normal">runs your business.</span>
          </h1>
          <p className="text-neutral-400 text-lg mb-10 max-w-lg mx-auto">
            Full-stack development, automation systems, and AI integrations.
            Shipped fast, built to last.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/work"
              className="inline-flex items-center gap-2 bg-white text-neutral-900 px-6 py-2.5 rounded-md text-sm font-medium hover:bg-neutral-200 transition-colors"
            >
              View work <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="mailto:contact@evenslouis.ca"
              className="inline-flex items-center gap-2 border border-neutral-700 px-6 py-2.5 rounded-md text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-neutral-800 py-6 text-center text-sm text-neutral-500">
        &copy; {new Date().getFullYear()} Evens Louis
      </footer>
    </div>
  );
}
