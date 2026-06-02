import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { preparePasswordReset, sendPasswordResetEmail } from "@/lib/email-verification";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

async function requestPasswordReset(formData: FormData) {
  "use server";

  const email = cleanEmail(formData.get("email"));
  if (!email) {
    redirect("/forgot-password?error=missing_email");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });

    if (user) {
      const resetCode = await preparePasswordReset(user.id);
      const emailResult = await sendPasswordResetEmail({
        email,
        name: user.name,
        token: resetCode,
      });

      if (!emailResult.ok) {
        console.error("Failed to send reset email:", emailResult.reason);
        if (emailResult.reason === "missing_config") {
          redirect("/forgot-password?error=email_config_missing");
        }
        redirect("/forgot-password?error=send_failed");
      }
    }

    redirect(`/reset-password?status=sent&email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error("Error requesting password reset:", error);
    redirect("/forgot-password?error=send_failed");
  }
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>; 
}) {
  const params = searchParams ? await searchParams : {};
  const { error } = params;

  const errorMessage =
    error === "missing_email"
      ? "Enter your email so we can send a reset code."
      : error === "email_config_missing"
        ? "Email sending is not configured. Please contact support."
        : error === "send_failed"
          ? "Unable to send reset code. Please try again later."
          : null;

  return (
    <div className="page auth-page">
      <div className="page-header">
        <p className="eyebrow">DueKeeper</p>
        <h1 className="page-title">Forgot Password</h1>
        <p className="muted">Enter the email on your account and we’ll send a 6-digit reset code.</p>
      </div>

      <form action={requestPasswordReset} className="panel auth-card">
        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        <label className="stack">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <button type="submit" className="form-primary">Send reset code</button>
        <p className="auth-links">
          Remembered your password? <Link href="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
