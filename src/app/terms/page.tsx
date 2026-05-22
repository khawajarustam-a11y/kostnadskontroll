import type { Metadata } from "next";
import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";

export const metadata: Metadata = {
  title: "Terms of Service | DueKeeper",
  description: "The basic terms for using DueKeeper.",
};

const lastUpdated = "May 23, 2026";

export default function TermsPage() {
  return (
    <div className="page public-page legal-page">
      <Link className="legal-back-link" href="/">
        Back to DueKeeper
      </Link>

      <header className="legal-hero">
        <p className="public-eyebrow">Legal</p>
        <h1>Terms of Service</h1>
        <p>Last updated: {lastUpdated}</p>
      </header>

      <section className="legal-panel">
        <h2>Acceptance</h2>
        <p>
          By using DueKeeper, you agree to these terms. If you do not agree, do not use the service.
        </p>

        <h2>What DueKeeper Does</h2>
        <p>
          DueKeeper helps you organize subscriptions, contracts, renewal dates, cancellation
          deadlines, costs, and reminders. The service may include manual entry, file import, email
          text import, AI extraction, and reminder features.
        </p>

        <h2>Your Responsibility</h2>
        <p>
          You are responsible for checking the accuracy of information saved in DueKeeper. AI
          extraction and imported data can be incomplete or incorrect, so you should review dates,
          amounts, vendors, and deadlines before relying on them.
        </p>

        <h2>No Professional Advice</h2>
        <p>
          DueKeeper is an organizational tool. It does not provide legal, financial, accounting, or
          tax advice. You should consult qualified professionals for advice about contracts,
          payments, compliance, or legal obligations.
        </p>

        <h2>Accounts</h2>
        <p>
          You are responsible for keeping your login details secure and for activity that happens
          through your account. Use accurate account information and notify us if you suspect
          unauthorized access.
        </p>

        <h2>Acceptable Use</h2>
        <p>
          Do not misuse DueKeeper, attempt to disrupt the service, upload unlawful content, reverse
          engineer protected parts of the service, or use the service in a way that harms others.
        </p>

        <h2>Availability</h2>
        <p>
          We aim to keep DueKeeper reliable, but the service may change, pause, or become
          unavailable from time to time. We are still improving the product and may change features
          as we learn from users.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          To the maximum extent allowed by law, DueKeeper is provided as is and we are not liable for
          indirect, incidental, special, consequential, or punitive damages, or for missed renewals,
          missed cancellations, business losses, or inaccurate imported data.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms as the product changes. Continued use of DueKeeper after updates
          means you accept the updated terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent through the <Link href="/contact">contact page</Link>.
        </p>
      </section>

      <PublicFooter />
    </div>
  );
}
