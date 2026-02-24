"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

const SOURCES = [
  { value: "upwork", label: "Upwork" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "referral", label: "Referral" },
  { value: "inbound", label: "Inbound" },
  { value: "rss", label: "RSS" },
  { value: "other", label: "Other" },
];

export interface LeadFormData {
  source: string;
  title: string;
  company: string;
  contactName: string;
  contactEmail: string;
  link: string;
  summary: string;
  budgetMin: string;
  budgetMax: string;
  urgency: string;
  tags: string;
}

const defaults: LeadFormData = {
  source: "other",
  title: "",
  company: "",
  contactName: "",
  contactEmail: "",
  link: "",
  summary: "",
  budgetMin: "",
  budgetMax: "",
  urgency: "medium",
  tags: "",
};

export function LeadFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: LeadFormData) => void;
  initial?: Partial<LeadFormData>;
  loading?: boolean;
}) {
  const [form, setForm] = useState<LeadFormData>({ ...defaults, ...initial });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 className="text-lg font-semibold">New Lead</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Source *</label>
            <select
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className="w-full rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
              required
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Title *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Need a funnel built"
              maxLength={500}
              required
              className="bg-neutral-800 border-neutral-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Company</label>
            <Input
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              placeholder="Company name"
              maxLength={200}
              className="bg-neutral-800 border-neutral-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Contact name</label>
              <Input
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                placeholder="Name"
                className="bg-neutral-800 border-neutral-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                placeholder="email@example.com"
                className="bg-neutral-800 border-neutral-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Link</label>
            <Input
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              placeholder="https://..."
              type="url"
              className="bg-neutral-800 border-neutral-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Summary *</label>
            <Textarea
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="Brief description of the opportunity..."
              rows={4}
              maxLength={10000}
              required
              className="bg-neutral-800 border-neutral-600 resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Budget min</label>
              <Input
                type="number"
                min={0}
                value={form.budgetMin}
                onChange={(e) => setForm((f) => ({ ...f, budgetMin: e.target.value }))}
                placeholder="0"
                className="bg-neutral-800 border-neutral-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Budget max</label>
              <Input
                type="number"
                min={0}
                value={form.budgetMax}
                onChange={(e) => setForm((f) => ({ ...f, budgetMax: e.target.value }))}
                placeholder="0"
                className="bg-neutral-800 border-neutral-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Urgency</label>
              <select
                value={form.urgency}
                onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
                className="w-full rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Tags</label>
            <Input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="website, automation (comma-separated)"
              className="bg-neutral-800 border-neutral-600"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create Lead"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
