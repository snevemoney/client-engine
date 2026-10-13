import { LegalPage, LegalSection } from "@/components/site/LegalPage";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Tools | Evens Louis",
  description: "Small, free helpers Evens uses to build with AI agents.",
};

const tools = [
  ["fw-transcribe", "Local speech-to-text on CPU (faster-whisper, int8); writes txt/srt/vtt/json", "Linux, Python venv"],
  ["Dictate → prompt", "Turns a phone voice memo into an agent prompt, keeping the raw transcript", "Linux + fw-transcribe"],
  ["Feature loop kit", "Checks first, locked; a fresh builder per round; keep only if the score goes up; offline watchdog", "git + Python"],
  ["Skill scorer", "Re-runs a skill's checks before/after an edit and says KEEP or REVERT", "Python"],
  ["Run tracer", "One JSONL line per run: latency, tokens, cost, tools; no server", "Python"],
  ["Best-of-N", "Generates N drafts and ranks them on a fixed rubric (advisory; a human picks)", "Python + OpenRouter"],
];

export default function ToolsPage() {
  return (
    <LegalPage title="Tools" description="Small, free helpers Evens uses to build with AI agents." lastUpdated="October 2026">
      <LegalSection title="What's here">
        <ul>
          {tools.map(([name, what, runs]) => (
            <li key={name}>
              <strong>{name}:</strong> {what} <em>({runs})</em>
            </li>
          ))}
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
