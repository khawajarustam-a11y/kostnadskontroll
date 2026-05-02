import Link from "next/link";

export default function Home() {
  return (
    <div className="page public-page">
      <section className="public-hero">
        <p className="eyebrow">Early access</p>
        <h1>Never miss a renewal or cancellation deadline again.</h1>
        <p className="public-hero-copy">
          RenewalGuard helps freelancers and small teams find contracts, track upcoming charges,
          and get reminders before money leaves the account.
        </p>
        <div className="page-actions">
          <Link className="form-primary" href="/login">
            Open the app
          </Link>
          <Link className="form-secondary" href="/feedback">
            Send feedback
          </Link>
        </div>
      </section>

      <section className="public-grid" aria-label="What RenewalGuard helps with">
        <div>
          <span>1</span>
          <h2>Import documents</h2>
          <p>Upload files or paste email text so the important contract details can be reviewed.</p>
        </div>
        <div>
          <span>2</span>
          <h2>See what is at risk</h2>
          <p>Renewal dates, cancellation deadlines, and possible charges are shown clearly.</p>
        </div>
        <div>
          <span>3</span>
          <h2>Get reminded</h2>
          <p>Email reminders help users act before subscriptions or contracts renew automatically.</p>
        </div>
      </section>

      <section className="public-feedback-strip">
        <div>
          <p className="eyebrow">Beta feedback</p>
          <h2>Trying it? Tell us what feels confusing, useful, or missing.</h2>
        </div>
        <Link className="form-primary" href="/feedback">
          Give feedback
        </Link>
      </section>
    </div>
  );
}
