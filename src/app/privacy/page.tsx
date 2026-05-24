import type { Metadata } from "next";
import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How DueKeeper handles account, contract, cost, import, and feedback data.",
  alternates: {
    canonical: "/privacy",
  },
  robots: {
    index: false,
    follow: true,
  },
};

const lastUpdated = "May 23, 2026";

export default function PrivacyPage() {
  return (
    <div className="page public-page legal-page">
      <Link className="legal-back-link" href="/">
        Back to DueKeeper
      </Link>

      <header className="legal-hero">
        <p className="public-eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p>Last updated: {lastUpdated}</p>
      </header>

      <section className="legal-panel">
        <h2>Overview</h2>
        <p>
          DueKeeper helps users track subscriptions, contracts, renewal dates, cancellation
          deadlines, costs, and related reminders. This policy explains what information we collect,
          why we collect it, and how we protect it.
        </p>

        <h2>Information We Collect</h2>
        <p>
          We collect account information such as your email address and password hash, workspace
          settings, cost records, contract records, uploaded or pasted import content, feedback
          messages, and technical information needed to run and secure the service.
        </p>

        <h2>How We Use Information</h2>
        <p>
          We use your information to provide the product, save and display your records, process
          imports, send reminders, respond to feedback, prevent abuse, debug errors, and improve
          DueKeeper.
        </p>

        <h2>AI Imports</h2>
        <p>
          If you use AI import features, the text or file content you submit may be sent to an AI
          provider to extract useful contract or cost details. You should review extracted details
          before saving them.
        </p>

        <h2>Email and Integrations</h2>
        <p>
          If you connect an email provider, DueKeeper only uses the connection for features you
          choose, such as finding renewal-related information. You can disconnect integrations from
          your account settings when available.
        </p>

        <h2>Service Providers</h2>
        <p>
          We use trusted service providers for hosting, database storage, email delivery,
          observability, and AI processing. These providers process data only as needed to operate
          DueKeeper.
        </p>

        <h2>Data Retention</h2>
        <p>
          We keep account and product data while your account is active or as needed to provide the
          service, comply with legal obligations, resolve disputes, and maintain security.
        </p>

        <h2>Your Choices</h2>
        <p>
          You can update or delete records in the app. You can also request account deletion or ask
          questions about your data through the contact page.
        </p>

        <h2>Security</h2>
        <p>
          We use reasonable technical and organizational safeguards to protect your information.
          No online service can guarantee perfect security, but we work to reduce risk.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this policy as DueKeeper changes. If changes are significant, we will make
          reasonable efforts to notify users.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy can be sent through the <Link href="/contact">contact page</Link>.
        </p>
      </section>

      <PublicFooter />
    </div>
  );
}
