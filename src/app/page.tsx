import Link from "next/link";
import PublicThemePicker from "@/components/PublicThemePicker";

export default function Home() {
  return (
    <div className="page public-page">
      <header className="public-header">
        <Link className="public-brand" href="/">
          RenewalGuard
        </Link>
        <nav className="public-nav" aria-label="Public navigation">
          <Link href="#how-it-works">How it works</Link>
          <Link href="#trust">Trust</Link>
          <Link href="#pricing">Pricing</Link>
          <Link href="/feedback">Feedback</Link>
          <Link className="public-login" href="/login">
            Log in
          </Link>
        </nav>
      </header>

      <section className="public-hero">
        <p className="eyebrow">Early access</p>
        <h1>Never miss a renewal or cancellation deadline again.</h1>
        <p className="public-hero-copy">
          RenewalGuard helps freelancers and small teams find contracts, review upcoming charges,
          and get reminders before money leaves the account.
        </p>
        <div className="page-actions">
          <Link className="form-primary" href="/login">
            Try RenewalGuard
          </Link>
          <Link className="form-secondary" href="/feedback">
            Send feedback
          </Link>
        </div>
      </section>

      <section className="public-problem" aria-label="Problem RenewalGuard solves">
        <div>
          <p className="eyebrow">The problem</p>
          <h2>Subscriptions renew quietly. Contracts expire. Cancellation dates get missed.</h2>
        </div>
        <p>
          RenewalGuard is built for people who use many tools and do not want to keep every
          renewal date in their head. The goal is simple: know what can charge you before it happens.
        </p>
      </section>

      <section id="how-it-works" className="public-grid" aria-label="How RenewalGuard works">
        <div>
          <span>1</span>
          <h2>Import documents</h2>
          <p>Upload a file, paste email text, or add a contract manually when you already know the details.</p>
        </div>
        <div>
          <span>2</span>
          <h2>Review what AI found</h2>
          <p>Check the vendor, price, renewal date, and cancellation deadline before anything is saved.</p>
        </div>
        <div>
          <span>3</span>
          <h2>Get reminded</h2>
          <p>Email reminders help users act before subscriptions or contracts renew automatically.</p>
        </div>
      </section>

      <section id="trust" className="public-trust" aria-label="Trust and privacy">
        <div>
          <p className="eyebrow">Built for control</p>
          <h2>You review everything before it becomes part of your account.</h2>
        </div>
        <div className="public-trust-list">
          <p>No hidden auto-save after import.</p>
          <p>You can edit extracted details before saving.</p>
          <p>Connected inbox scanning is optional and will stay under your control.</p>
        </div>
      </section>

      <section id="pricing" className="public-beta-panel" aria-label="Early access and pricing">
        <div>
          <p className="eyebrow">Early access</p>
          <h2>Try RenewalGuard now. Pricing comes later.</h2>
          <p>
            We are focused on learning from early users first. Pricing will be introduced after
            the beta period, with clear plans before anything changes.
          </p>
        </div>
        <PublicThemePicker />
      </section>

      <section className="public-feedback-strip">
        <div>
          <p className="eyebrow">Beta feedback</p>
          <h2>Trying it? Tell us what feels confusing, useful, or missing.</h2>
          <p>RenewalGuard is new. Your feedback helps shape what we build next.</p>
        </div>
        <Link className="form-primary" href="/feedback">
          Give feedback
        </Link>
      </section>
    </div>
  );
}
