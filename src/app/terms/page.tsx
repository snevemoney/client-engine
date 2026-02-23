import { LegalPage, LegalSection } from "@/components/site/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Evens Louis",
  description: "Terms of service for evenslouis.ca and client engine services.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="General terms for using evenslouis.ca and our services. Project-specific agreements may override these."
      lastUpdated="February 2025"
    >
      <LegalSection title="Services">
        <p>We build software, websites, dashboards, automation, and AI tools for businesses. Scope, deliverables, and timelines are defined in project agreements or statements of work — those override these general terms when they differ.</p>
      </LegalSection>

      <LegalSection title="Your responsibilities">
        <ul>
          <li>Provide accurate information and cooperate during projects.</li>
          <li>Use our services lawfully. You are responsible for any content or data you provide.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>Unless agreed otherwise in writing, custom work belongs to you once paid in full. We keep rights to pre-existing tools, frameworks, and know-how we use.</p>
      </LegalSection>

      <LegalSection title="Payment and project terms">
        <p>Payment and project details are in each agreement. Without a separate agreement, payment is due as invoiced and we follow the scope and timeline agreed in writing.</p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>Services are provided &quot;as is.&quot; We don&apos;t warrant they&apos;ll be error-free or uninterrupted. We work in good faith to meet agreed specs.</p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>To the extent permitted by law, our liability is limited to the amount paid for the relevant work. We are not liable for indirect, incidental, or consequential damages.</p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>Either party may end a project per the applicable agreement. You remain responsible for fees for work already completed.</p>
      </LegalSection>

      <LegalSection title="Changes to terms">
        <p>We may update these terms. Continued use after changes means you accept them. We&apos;ll post material changes on this page.</p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>These terms are governed by the laws of Quebec and Canada. Disputes go to the courts of Quebec.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions? Email <a href="mailto:contact@evenslouis.ca">contact@evenslouis.ca</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
