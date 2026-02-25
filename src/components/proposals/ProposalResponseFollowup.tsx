"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, Phone, CheckCircle2, MessageSquare } from "lucide-react";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

type Proposal = {
  id: string;
  status: string;
  sentAt?: string | null;
  viewedAt?: string | null;
  respondedAt?: string | null;
  meetingBookedAt?: string | null;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  followUpCount?: number;
  responseStatus?: string;
  responseSummary?: string | null;
  bookingUrlUsed?: string | null;
};

type Props = {
  proposal: Proposal;
  onAction: (key: string, fn: () => Promise<Response>) => void;
  actionLoading: string | null;
};

export function ProposalResponseFollowup({ proposal, onAction, actionLoading }: Props) {
  const [snoozePreset, setSnoozePreset] = useState<"2d" | "5d" | "next_monday">("2d");
  const [scheduleDate, setScheduleDate] = useState("");
  const [responseStatus, setResponseStatus] = useState<"viewed" | "replied" | "meeting_booked" | "negotiating">("replied");
  const [showSnooze, setShowSnooze] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  const isSent = proposal.status === "sent" || proposal.status === "viewed";
  if (!isSent) return null;

  const run = (key: string, body: object) =>
    onAction(key, () =>
      fetch(`/api/proposals/${proposal.id}/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );

  return (
    <div className="rounded-lg border border-neutral-800 p-4 space-y-4">
      <h3 className="text-sm font-medium text-neutral-400">Response & Follow-up</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <span className="text-neutral-500">Sent</span>
          <p className="text-neutral-200">{formatDate(proposal.sentAt)}</p>
        </div>
        <div>
          <span className="text-neutral-500">Viewed</span>
          <p className="text-neutral-200">{formatDate(proposal.viewedAt)}</p>
        </div>
        <div>
          <span className="text-neutral-500">Responded</span>
          <p className="text-neutral-200">{formatDate(proposal.respondedAt)}</p>
        </div>
        <div>
          <span className="text-neutral-500">Meeting booked</span>
          <p className="text-neutral-200">{formatDate(proposal.meetingBookedAt)}</p>
        </div>
        <div>
          <span className="text-neutral-500">Last contacted</span>
          <p className="text-neutral-200">{formatDate(proposal.lastContactedAt)}</p>
        </div>
        <div>
          <span className="text-neutral-500">Next follow-up</span>
          <p className="text-neutral-200">{formatDate(proposal.nextFollowUpAt)}</p>
        </div>
        <div>
          <span className="text-neutral-500">Follow-up count</span>
          <p className="text-neutral-200">{proposal.followUpCount ?? 0}</p>
        </div>
        <div>
          <span className="text-neutral-500">Response status</span>
          <Badge variant="outline" className="capitalize mt-1">
            {(proposal.responseStatus ?? "none").replace(/_/g, " ")}
          </Badge>
        </div>
      </div>
      {proposal.responseSummary && (
        <div>
          <span className="text-neutral-500 text-sm">Summary</span>
          <p className="text-neutral-300 text-sm mt-1">{proposal.responseSummary}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSchedule(!showSchedule)}
          disabled={!!actionLoading}
        >
          <Calendar className="w-4 h-4 mr-1" />
          Schedule
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSnooze(!showSnooze)}
          disabled={!!actionLoading}
        >
          Snooze
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => run("followup-log-email", {})}
          disabled={!!actionLoading}
        >
          <Mail className="w-4 h-4 mr-1" />
          Log Email
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => run("followup-log-call", {})}
          disabled={!!actionLoading}
        >
          <Phone className="w-4 h-4 mr-1" />
          Log Call
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => run("followup-complete", {})}
          disabled={!!actionLoading}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" />
          Complete
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowResponse(!showResponse)}
          disabled={!!actionLoading}
        >
          <MessageSquare className="w-4 h-4 mr-1" />
          Log Response
        </Button>
      </div>

      {showSchedule && (
        <div className="flex gap-2 items-center p-2 bg-neutral-900/50 rounded">
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm"
          />
          <Button
            size="sm"
            onClick={() => {
              if (scheduleDate) {
                run("followup-schedule", { nextFollowUpAt: new Date(scheduleDate).toISOString() });
                setShowSchedule(false);
                setScheduleDate("");
              }
            }}
          >
            Set
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSchedule(false)}>Cancel</Button>
        </div>
      )}

      {showSnooze && (
        <div className="flex gap-2 items-center p-2 bg-neutral-900/50 rounded flex-wrap">
          <select
            value={snoozePreset}
            onChange={(e) => setSnoozePreset(e.target.value as "2d" | "5d" | "next_monday")}
            className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm"
          >
            <option value="2d">+2 days</option>
            <option value="5d">+5 days</option>
            <option value="next_monday">Next Monday</option>
          </select>
          <Button
            size="sm"
            onClick={() => {
              run("followup-snooze", { preset: snoozePreset });
              setShowSnooze(false);
            }}
          >
            Snooze
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSnooze(false)}>Cancel</Button>
        </div>
      )}

      {showResponse && (
        <div className="flex gap-2 items-center p-2 bg-neutral-900/50 rounded flex-wrap">
          <select
            value={responseStatus}
            onChange={(e) => setResponseStatus(e.target.value as typeof responseStatus)}
            className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm"
          >
            <option value="viewed">Viewed</option>
            <option value="replied">Replied</option>
            <option value="meeting_booked">Meeting booked</option>
            <option value="negotiating">Negotiating</option>
          </select>
          <Button
            size="sm"
            onClick={() => {
              run("response", { responseStatus });
              setShowResponse(false);
            }}
          >
            Log
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowResponse(false)}>Cancel</Button>
        </div>
      )}

      {proposal.bookingUrlUsed && (
        <div className="text-xs">
          <a href={proposal.bookingUrlUsed} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
            Open booking link
          </a>
        </div>
      )}
    </div>
  );
}
