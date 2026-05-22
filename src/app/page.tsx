import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";
import PublicThemePicker from "@/components/PublicThemePicker";

const riskItems = [
  { name: "Canva Pro", detail: "Renews in 8 days", status: "Review", tone: "warning" },
  { name: "Figma", detail: "Cancel by May 24", status: "Urgent", tone: "danger" },
  { name: "Adobe Creative Cloud", detail: "Protected", status: "Safe", tone: "safe" },
] as const;

const workflow = [
  {
    title: "Import documents",
    text: "Upload a file, paste email text, or add a contract manually when you already know the details.",
  },
  {
    title: "Review what AI found",
    text: "Check the vendor, renewal date, and cancellation deadline before anything is saved.",
  },
  {
    title: "Get reminded",
    text: "Email reminders help you act before subscriptions or contracts renew.",
  },
] as const;

const trustItems = [
  "No hidden auto-save after import.",
  "You can edit extracted details before saving.",
  "Connected inbox scanning is optional and stays under your control.",
] as const;

export default function Home() {
  return (
    <div className="page public-page">
      <header className="public-header">
        <Link className="public-brand" href="/">
          DueKeeper
        </Link>
        <nav className="public-nav" aria-label="Public navigation">
          <Link href="#how-it-works">How it works</Link>
          <Link href="#trust">Trust</Link>
          <Link href="/feedback">Feedback</Link>
          <Link href="/contact">Contact</Link>
          <Link className="public-login" href="/login">
            Log in
          </Link>
          <PublicThemePicker compact />
        </nav>
      </header>

      <section className="public-hero public-hero-redesign">
        <div className="public-hero-content">
          <p className="public-eyebrow">New</p>
          <h1>Never miss subscription and contract renewals again.</h1>
          <p>
            DueKeeper helps freelancers and small teams upload contracts, invoices, and emails,
            then shows renewal dates and cancellation deadlines before they surprise you.
          </p>
          <div className="public-hero-actions">
            <Link className="public-primary-cta" href="/login">
              Try DueKeeper
            </Link>
            <Link className="public-secondary-cta" href="/feedback">
              Send feedback
            </Link>
          </div>
          <div className="public-proof-row" aria-label="Key product promises">
            <span>AI import</span>
            <span>Email reminders</span>
            <span>Review before saving</span>
          </div>
        </div>

        <div className="public-product-preview" aria-label="DueKeeper product preview">
          <div className="public-preview-shell">
            <div className="public-preview-top">
              <strong>DueKeeper</strong>
              <span>Protected</span>
            </div>
            <div className="public-preview-alert">
              <div>
                <span>Renewal detected</span>
                <strong>Canva Pro renews in 8 days</strong>
              </div>
              <b>Review</b>
            </div>
            <div className="public-preview-metrics">
              <div>
                <span>Protected contracts</span>
                <strong>12</strong>
              </div>
              <div>
                <span>Action items</span>
                <strong>3</strong>
              </div>
              <div>
                <span>Upcoming renewals</span>
                <strong>5</strong>
              </div>
            </div>
            <div className="public-preview-list">
              {riskItems.map((item) => (
                <div className={"public-preview-row public-preview-row-" + item.tone} key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <b>{item.status}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="public-feature-band">
        <div className="public-feature-copy">
          <p className="public-eyebrow">The problem</p>
          <h2>Subscriptions renew quietly. Contracts expire. Cancellation dates get missed.</h2>
          <p>
            DueKeeper is built for people who use many tools and do not want to keep every renewal
            date in their head.
          </p>
        </div>
        <div className="public-risk-stack">
          <div className="public-risk-card">
            <span>01</span>
            <strong>Forgotten renewals</strong>
            <p>Know what can renew next before important deadlines sneak up.</p>
          </div>
          <div className="public-risk-card">
            <span>02</span>
            <strong>Silent contract changes</strong>
            <p>Keep vendor and renewal details visible in one place.</p>
          </div>
          <div className="public-risk-card">
            <span>03</span>
            <strong>Missed cancel windows</strong>
            <p>Track cancel-by dates before contracts lock in again.</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="public-workflow-grid">
        {workflow.map((step, index) => (
          <article className="public-workflow-card" key={step.title}>
            <span className="public-card-index">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </section>

      <section className="public-automation-panel">
        <div>
          <p className="public-eyebrow">Automation</p>
          <h2>Designed for the way contracts arrive.</h2>
          <p>
            Start simple: upload documents, paste email text, or add a contract manually. Connected
            inbox scanning can come later when you are ready.
          </p>
        </div>
        <div className="public-pipeline">
          <div className="public-pipeline-card">
            <strong>Upload files</strong>
            <span>PDFs, screenshots, invoices, and contract text.</span>
          </div>
          <div className="public-pipeline-card">
            <strong>Paste emails</strong>
            <span>Copy renewal emails from Gmail or Outlook and scan them instantly.</span>
          </div>
          <div className="public-pipeline-card">
            <strong>Review before saving</strong>
            <span>You decide what becomes part of your account.</span>
          </div>
          <div className="public-pipeline-card">
            <strong>Reminders before deadlines</strong>
            <span>Act before renewal and cancellation dates pass.</span>
          </div>
        </div>
      </section>

      <section id="trust" className="public-trust public-trust-redesign">
        <div>
          <p className="public-eyebrow">Trust</p>
          <h2>You stay in control.</h2>
          <p>
            DueKeeper is built around review-first automation, so imported data is checked before it
            becomes part of your account.
          </p>
        </div>
        <div className="public-trust-grid">
          {trustItems.map((item) => (
            <div className="public-trust-card" key={item}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="public-feedback-strip public-feedback-redesign">
        <div>
          <p className="public-eyebrow">Feedback</p>
          <h2>Trying it? Tell us what feels confusing, useful, or missing.</h2>
          <p>DueKeeper is new. Your feedback helps shape what we build next.</p>
        </div>
        <Link className="public-primary-cta" href="/feedback">
          Give feedback
        </Link>
      </section>

      <PublicFooter />
    </div>
  );
}
