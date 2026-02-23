import { LegalPage, LegalSection } from "@/components/site/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Evens Louis",
  description: "Privacy policy for evenslouis.ca and client engine services.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How we collect, use, and protect your information at evenslouis.ca."
      lastUpdated="February 2025"
    >
      <LegalSection title="Information we collect">
        <p>We may collect:</p>
        <ul>
          <li><strong>Contact:</strong> Name, email, company or website when you fill out forms or reach out.</li>
          <li><strong>Project details:</strong> What you tell us about your goals and business needs.</li>
          <li><strong>Technical data:</strong> Browser type, IP, pages visited — standard web logs and analytics.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>We use this information to deliver services, respond to inquiries, improve the site, and stay in touch about projects and support.</p>
      </LegalSection>

      <LegalSection title="Sharing">
        <p>We may share data with service providers (hosting, email, analytics) needed to run the business. We may disclose when required by law. We do not sell personal data.</p>
      </LegalSection>

      <LegalSection title="Data retention">
        <p>We keep data as long as needed for service, support, and legal or accounting obligations. You can request deletion anytime — see our <a href="/data-deletion">Data Deletion</a> page.</p>
      </LegalSection>

      <LegalSection title="Security">
        <p>We take reasonable steps to protect your data. No internet transmission is fully secure; we cannot guarantee absolute security.</p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Depending on where you live, you may access, correct, or delete your data. You can unsubscribe from emails anytime. Contact us to exercise these rights.</p>
      </LegalSection>

      <LegalSection title="Third-party services">
        <p>We use third parties such as Meta/WhatsApp (where applicable), analytics, and hosting. Their privacy policies govern their handling of data.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions? Email <a href="mailto:contact@evenslouis.ca">contact@evenslouis.ca</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
