import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hashEmailVerificationToken, prepareEmailVerification, sendVerificationEmail } from "@/lib/email-verification";
import { createSession, getActiveSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanCode(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function verifyEmailCode(formData: FormData) {
  "use server";

  const email = cleanEmail(formData.get("email"));
  const code = cleanCode(formData.get("code"));

  if (!email || !code) {
    redirect("/verify-email?error=missing_data");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        companyId: true,
        emailVerificationTokenHash: true,
        emailVerificationTokenExpiresAt: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      redirect("/verify-email?error=invalid_email");
    }

    if (user.emailVerifiedAt) {
      redirect("/verify-email?success=already_verified");
    }

    if (!user.emailVerificationTokenHash || !user.emailVerificationTokenExpiresAt) {
      redirect("/verify-email?error=code_not_requested&email=" + encodeURIComponent(email));
    }

    if (new Date() > user.emailVerificationTokenExpiresAt) {
      redirect("/verify-email?error=code_expired&email=" + encodeURIComponent(email));
    }

    if (hashEmailVerificationToken(code) !== user.emailVerificationTokenHash) {
      redirect("/verify-email?error=invalid_code&email=" + encodeURIComponent(email));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    await createSession({ userId: user.id, companyId: user.companyId });
    redirect("/dashboard");
  } catch (error) {
    console.error("Email verification error:", error);
    redirect("/verify-email?error=verification_failed&email=" + encodeURIComponent(email));
  }
}

async function resendVerificationCode(formData: FormData) {
  "use server";

  const email = cleanEmail(formData.get("email"));

  if (!email) {
    redirect("/verify-email?error=missing_email");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      redirect("/verify-email?error=invalid_email");
    }

    if (user.emailVerifiedAt) {
      redirect("/verify-email?success=already_verified");
    }

    const verificationCode = await prepareEmailVerification(user.id);
    const emailResult = await sendVerificationEmail({
      email: user.email,
      name: user.name,
      token: verificationCode,
    });

    if (!emailResult.ok) {
      console.error("Failed to resend verification code:", emailResult.reason);
      redirect("/verify-email?error=resend_failed&email=" + encodeURIComponent(email));
    }

    redirect("/verify-email?success=email_resent&email=" + encodeURIComponent(email));
  } catch (error) {
    console.error("Error resending verification code:", error);
    redirect("/verify-email?error=resend_failed&email=" + encodeURIComponent(email));
  }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string; status?: string; email?: string }>;
}) {
  const session = await getActiveSession();
  if (session?.user.emailVerifiedAt) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const { error, success, status, email: paramEmail } = params;

  const errorMessage =
    error === "missing_data"
      ? "Please enter your email and verification code."
      : error === "invalid_email"
        ? "No account was found for that email."
        : error === "invalid_code"
          ? "The code is invalid. Please try again."
          : error === "code_expired"
            ? "This code has expired. Request a new one below."
            : error === "code_not_requested"
              ? "Verification code was not requested yet. Request a new code below."
              : error === "verification_failed"
                ? "Verification failed. Please try again."
                : error === "email_config_missing"
                  ? "Email verification is not configured. Please contact support."
                  : error === "send_failed"
                    ? "Unable to send the verification code. Please try again later."
                    : error === "missing_email"
                      ? "Please enter your email address."
                      : error === "resend_failed"
                        ? "Failed to resend verification code. Please try again."
                        : null;

  const successMessage =
    success === "already_verified"
      ? "Your email has already been verified!"
      : success === "email_resent"
        ? "A new verification code was sent to your email."
        : null;

  const isPending = status === "check_email";

  return (
    <div className="page auth-page">
      <div className="page-header">
        <p className="eyebrow">DueKeeper</p>
        <h1>Verify Email</h1>
      </div>

      <div className="page-content">
        {errorMessage ? (
          <div className="error-message" style={{ color: "#d32f2f", marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#ffebee", borderRadius: "4px" }}>
            <p style={{ margin: 0 }}>{errorMessage}</p>
          </div>
        ) : null}

        {successMessage ? (
          <div className="success-message" style={{ color: "#388e3c", marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#e8f5e9", borderRadius: "4px" }}>
            <p style={{ margin: 0 }}>{successMessage}</p>
          </div>
        ) : null}

        <div className="panel auth-card" style={{ textAlign: "center" }}>
          <p style={{ marginTop: 0 }}>{isPending ? "Check your email for the 6-digit code." : "Enter the 6-digit code we sent to your email."}</p>
          <p style={{ fontSize: "0.95rem", color: "#666", marginBottom: "1.5rem" }}>
            {isPending ? "Enter the code below when you receive it." : "If you did not receive a code, request a new one."}
          </p>

          <form action={verifyEmailCode} style={{ display: "grid", gap: "1rem", marginBottom: "1.5rem" }}>
            <label className="stack">
              <span>Email</span>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                defaultValue={paramEmail || ""}
                required
                autoComplete="email"
              />
            </label>
            <label className="stack">
              <span>Verification Code</span>
              <input
                type="text"
                name="code"
                placeholder="123456"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </label>
            <button type="submit" className="form-primary">Verify Email</button>
          </form>

          <div style={{ borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
            <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>Didn't receive a code?</p>
            <form action={resendVerificationCode} style={{ display: "grid", gap: "0.75rem" }}>
              <label className="stack">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  defaultValue={paramEmail || ""}
                  required
                  autoComplete="email"
                />
              </label>
              <button type="submit" className="form-secondary">Resend Code</button>
            </form>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link href="/login" style={{ color: "#1976d2", textDecoration: "none" }}>
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
