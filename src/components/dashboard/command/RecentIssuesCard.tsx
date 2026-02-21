import Link from "next/link";

type ErrorItem = { leadId: string; leadTitle: string; code: string | null; at: string | null };

export function RecentIssuesCard({ errors }: { errors: ErrorItem[] }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Recent errors / warnings</h2>
      {errors.length === 0 ? (
        <p className="text-xs text-neutral-500">No recent pipeline failures.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {errors.map((e) => (
            <li key={e.leadId}>
              <Link
                href={`/dashboard/leads/${e.leadId}`}
                className="text-neutral-300 hover:text-white"
              >
                {e.leadTitle}
              </Link>
              <span className="text-neutral-500 text-xs ml-1">
                {e.code ?? "error"} {e.at ? `· ${new Date(e.at).toLocaleString()}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
