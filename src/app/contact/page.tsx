import type { Metadata } from "next";
import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact DueKeeper for feedback, support, privacy, or product questions.",
  alternates: {
    canonical: "/contact",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function ContactPage() {
  return (
    <div className="page public-page legal-page">
      <Link className="legal-back-link" href="/">
        Back to DueKeeper
      </Link>

      <header className="legal-hero contact-hero">
        <p className="public-eyebrow">Contact</p>
        <h1>Talk to DueKeeper</h1>
        <p>
          Send product feedback, support questions, privacy requests, or anything that would help us
          make DueKeeper clearer and more useful.
        </p>
      </header>

      <section className="contact-grid">
        <article className="contact-card">
          <h2>Fastest option</h2>
          <p>
            Use the feedback form. It sends your message directly from the website and gives us the
            context we need to reply or improve the product.
          </p>
          <Link className="public-primary-cta" href="/feedback">
            Open feedback form
          </Link>
        </article>

        <article className="contact-card">
          <h2>Email</h2>
          <p>
            Domain email is being set up. The planned support address is{" "}
            <strong>support@duekeeper.com</strong>.
          </p>
          <p className="muted">
            Until email DNS is finished, use the feedback form so your message is not missed.
          </p>
        </article>

        <article className="contact-card">
          <h2>Privacy or account requests</h2>
          <p>
            For privacy questions, account deletion requests, or data access questions, include the
            email address connected to your DueKeeper account.
          </p>
          <Link className="public-secondary-cta" href="/privacy">
            Read privacy policy
          </Link>
        </article>
      </section>

      <PublicFooter />
    </div>
  );
}
