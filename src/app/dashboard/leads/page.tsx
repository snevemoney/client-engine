import { LeadsTable } from "@/components/dashboard/leads-table";

export const dynamic = "force-dynamic";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-neutral-400 mt-1">Manage and track incoming leads.</p>
      </div>
      <LeadsTable />
    </div>
  );
}
