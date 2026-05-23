import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { isFeedbackAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  }).format(date);
}

export default async function FeedbackInboxPage() {
  const session = await requireSession();
  const canViewFeedback = await isFeedbackAdmin(session);

  if (!canViewFeedback) {
    notFound();
  }

  const messages = await prisma.feedbackMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Feedback Inbox</h1>
        <p className="page-subtitle">Messages sent from the public DueKeeper feedback form.</p>
      </div>

      {messages.length === 0 ? (
        <section className="panel empty-state">
          <h2>No feedback yet</h2>
          <p>New feedback messages will appear here as soon as someone submits the form.</p>
        </section>
      ) : (
        <section className="feedback-inbox-list" aria-label="Feedback messages">
          {messages.map((message) => (
            <article className="panel feedback-inbox-card" key={message.id}>
              <div className="feedback-inbox-card-header">
                <div>
                  <h2>{message.name || "Anonymous"}</h2>
                  <a href={`mailto:${message.email}`}>{message.email}</a>
                </div>
                <div className="feedback-inbox-meta">
                  <span>{formatDate(message.createdAt)}</span>
                  <span className={message.emailedAt ? "status-pill status-pill-ok" : "status-pill status-pill-warning"}>
                    {message.emailedAt ? "Emailed" : "Saved"}
                  </span>
                </div>
              </div>

              <dl className="feedback-inbox-details">
                <div>
                  <dt>Role</dt>
                  <dd>{message.role || "Not provided"}</dd>
                </div>
                <div>
                  <dt>Interest</dt>
                  <dd>{message.interest || "Not provided"}</dd>
                </div>
              </dl>

              <p className="feedback-inbox-message">{message.message}</p>

              {message.emailError ? (
                <p className="feedback-inbox-error">Email copy failed: {message.emailError}</p>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
