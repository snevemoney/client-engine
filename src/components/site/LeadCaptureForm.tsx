"use client";

import { useState } from "react";

const PRIMARY_CTA = "Request a workflow audit";

export function LeadCaptureForm({ className = "" }: { className?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/site/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          company: company.trim() || undefined,
          website: website.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      if (res.ok) {
        setStatus("done");
        setName("");
        setEmail("");
        setCompany("");
        setWebsite("");
        setMessage("");
      } else {
        const data = await res.json();
        setStatus("error");
        console.error(data.error);
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className={`rounded-lg border border-neutral-700 bg-neutral-900/50 p-6 text-center ${className}`}>
        <p className="text-neutral-200 font-medium">Thanks. I&apos;ll be in touch within 24 hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500"
        />
        <input
          type="email"
          placeholder="Email *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Company (optional)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500"
        />
        <input
          type="url"
          placeholder="Website (optional)"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500"
        />
      </div>
      <textarea
        placeholder="What's slowing your business down? (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 resize-none"
      />
      <button
        type="submit"
        disabled={status === "sending" || !email.trim()}
        className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-white text-neutral-900 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : PRIMARY_CTA}
      </button>
      {status === "error" && (
        <p className="text-sm text-amber-400">Something went wrong. Try again or email directly.</p>
      )}
    </form>
  );
}
