import Link from "next/link";
import { redirect } from "next/navigation";

type FeedbackPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendFeedbackEmail(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const interest = String(formData.get("interest") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!email || !message) {
    redirect("/feedback?status=missing");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.REMINDER_FROM_EMAIL;
  const toEmail = process.env.FEEDBACK_TO_EMAIL ?? process.env.REMINDER_FROM_EMAIL;

  if (!apiKey || !fromEmail || !toEmail) {
    redirect("/feedback?status=not_configured");
  }

  const safeName = escapeHtml(name || "Anonymous");
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(role || "Not provided");
  const safeInterest = escapeHtml(interest || "Not provided");
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: "New RenewalGuard feedback",
      html: `
        <h2>New RenewalGuard feedback</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Role:</strong> ${safeRole}</p>
        <p><strong>Interest:</strong> ${safeInterest}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
      text: [
        "New RenewalGuard feedback",
        `Name: ${name || "Anonymous"}`,
        `Email: ${email}`,
        `Role: ${role || "Not provided"}`,
        `Interest: ${interest || "Not provided"}`,
        "",
        message,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    redirect("/feedback?status=failed");
  }

  redirect("/feedback?status=sent");
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const params = await searchParams;
  const status = params?.status;

  return (
    <div className="page public-page">
      <div className="page-header">
        <p className="eyebrow">Feedback</p>
        <h1 className="page-title">Help shape RenewalGuard</h1>
        <p className="page-hero">
          Tell us what would make this useful enough for you to trust it with your renewals.
        </p>
        <p className="feedback-intro">
          RenewalGuard is new. Your feedback helps shape what we build next.
        </p>
      </div>

      {status === "sent" ? (
        <div className="feedback-status feedback-status-success">
          <strong>Thank you. Your feedback was sent.</strong>
          <span>That kind of early feedback is exactly what makes the product better.</span>
        </div>
      ) : null}

      {status === "missing" ? (
        <div className="feedback-status feedback-status-warning">
          Please add your email and a short message before sending.
        </div>
      ) : null}

      {status === "not_configured" ? (
        <div className="feedback-status feedback-status-warning">
          Feedback email is not configured yet. Add RESEND_API_KEY, REMINDER_FROM_EMAIL, and
          optionally FEEDBACK_TO_EMAIL in Vercel.
        </div>
      ) : null}

      {status === "failed" ? (
        <div className="feedback-status feedback-status-warning">
          Feedback could not be sent right now. Please try again later.
        </div>
      ) : null}

      <form className="panel feedback-form" action={sendFeedbackEmail}>
        <div className="feedback-form-grid">
          <label className="field-label">
            Name
            <input name="name" placeholder="Your name" />
          </label>
          <label className="field-label">
            Email
            <input name="email" type="email" placeholder="you@example.com" required />
          </label>
          <label className="field-label">
            What best describes you?
            <select name="role" defaultValue="">
              <option value="" disabled>
                Select one
              </option>
              <option>Freelancer</option>
              <option>Solo founder</option>
              <option>Small agency</option>
              <option>SaaS-heavy professional</option>
              <option>Other</option>
            </select>
          </label>
          <label className="field-label">
            What are you most interested in?
            <select name="interest" defaultValue="">
              <option value="" disabled>
                Select one
              </option>
              <option>Stopping forgotten renewals</option>
              <option>Importing contracts faster</option>
              <option>Email reminders</option>
              <option>Gmail or Outlook scanning</option>
              <option>Not sure yet</option>
            </select>
          </label>
        </div>

        <label className="field-label feedback-message">
          Feedback
          <textarea
            name="message"
            placeholder="What did you expect? What felt useful? What was confusing or missing?"
            required
          />
        </label>

        <div className="feedback-actions">
          <button type="submit" className="form-primary">
            Send feedback
          </button>
          <Link className="form-secondary" href="/">
            Back to website
          </Link>
        </div>
      </form>
    </div>
  );
}
