import Link from "next/link";

type NextAction = { leadId: string; title: string; action: string };
type BriefLead = { id: string; title: string; status: string; score: number | null };

export function TopOpportunitiesCard({
  nextActions,
  qualifiedLeads,
}: {
  nextActions: NextAction[];
  qualifiedLeads: BriefLead[];
}) {
  const top = nextActions.slice(0, 5);
  const leads = qualifiedLeads.slice(0, 5);
  const hasAny = top.length > 0 || leads.length > 0;

  if (!hasAny) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Top opportunities</h2>
        <p className="text-xs text-neutral-500">No ranked opportunities yet. Run the pipeline on leads.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Top opportunities</h2>
      <ul className="space-y-2">
        {top.map((a) => (
          <li key={a.leadId}>
            <Link
              href={`/dashboard/leads/${a.leadId}`}
              className="flex items-center justify-between rounded-md py-1.5 px-2 hover:bg-neutral-800/50 text-neutral-200 text-sm"
            >
              <span className="font-medium truncate mr-2">{a.title}</span>
              <span className="text-neutral-400 text-xs shrink-0">{a.action}</span>
            </Link>
          </li>
        ))}
        {leads.length > 0 && top.length < 5 && (
          <>
            {leads
              .filter((l) => !top.some((a) => a.leadId === l.id))
              .slice(0, 5 - top.length)
              .map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/dashboard/leads/${l.id}`}
                    className="flex items-center justify-between rounded-md py-1.5 px-2 hover:bg-neutral-800/50 text-neutral-200 text-sm"
                  >
                    <span className="font-medium truncate mr-2">{l.title}</span>
                    <span className="text-neutral-400 text-xs shrink-0">
                      Score {l.score ?? "—"}
                    </span>
                  </Link>
                </li>
              ))}
          </>
        )}
      </ul>
      <Link href="/dashboard/leads" className="text-xs text-neutral-400 hover:text-white mt-2 inline-block">
        All leads →
      </Link>
    </section>
  );
}
