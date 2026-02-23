import { LegalPage, LegalSection } from "@/components/site/LegalPage";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Data Deletion | Evens Louis",
  description: "How to request deletion of your data from evenslouis.ca and client engine.",
  alternates: { canonical: "https://evenslouis.ca/data-deletion" },
  openGraph: { url: "https://evenslouis.ca/data-deletion" },
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="User Data Deletion Instructions"
      description="How to request deletion of your data from evenslouis.ca and client engine."
      lastUpdated="February 2025"
    >
      <LegalSection title="How to request deletion">
        <p>Email <a href="mailto:contact@evenslouis.ca">contact@evenslouis.ca</a> with the subject &quot;Data Deletion Request.&quot; Include:</p>
        <ul>
          <li>Your full name</li>
          <li>Email address we have on file</li>
          <li>Company name (if applicable)</li>
          <li>Brief description of what you want deleted</li>
        </ul>
      </LegalSection>

      <LegalSection title="Response and timeline">
        <p>We&apos;ll confirm receipt and aim to process within 7–30 days, depending on the type and volume of data. We may contact you to verify your identity.</p>
      </LegalSection>

      <LegalSection title="Data we may retain">
        <p>We may keep some information when required by law — for example, for accounting, tax, or security purposes. Deletion requests cannot override those obligations.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>For deletion requests or questions: <a href="mailto:contact@evenslouis.ca">contact@evenslouis.ca</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
