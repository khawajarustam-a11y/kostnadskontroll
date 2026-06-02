import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hashEmailVerificationToken, prepareEmailVerification, sendVerificationEmail } from "@/lib/email-verification";
import { createSession, getActiveSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const runtime = "nodejs";

async function verifyEmailAction(token: string) {
  "use server";

  if (!token) {
    redirect("/verify-email?error=missing_token");
  }

  try {
    const tokenHash = hashEmailVerificationToken(token);

    const user = await prisma.user.findUnique({
      where: { emailVerificationTokenHash: tokenHash },
      select: {
        id: true,
        email: true,
        name: true,
        companyId: true,
        emailVerificationTokenExpiresAt: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      redirect("/verify-email?error=invalid_token");
    }

    if (user.emailVerifiedAt) {
      redirect("/verify-email?success=already_verified");
    }

    if (!user.emailVerificationTokenExpiresAt || user.emailVerificationTokenExpiresAt < new Date()) {
      redirect("/verify-email?error=token_expired");
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
    redirect("/verify-email?error=verification_failed");
  }
}

async function resendVerificationEmail(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/verify-email?error=missing_email");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      redirect("/verify-email?error=email_not_found");
    }

    if (user.emailVerifiedAt) {
      redirect("/verify-email?success=already_verified");
    }

    const verificationToken = await prepareEmailVerification(user.id);
    const emailResult = await sendVerificationEmail({
      email: user.email,
      name: user.name,
      token: verificationToken,
    });

    if (!emailResult.ok) {
      redirect("/verify-email?error=resend_failed");
    }

    redirect("/verify-email?success=email_resent");
  } catch (error) {
    console.error("Error resending verification email:", error);
    redirect("/verify-email?error=resend_failed");
  }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; error?: string; success?: string; status?: string; email?: string }>;
}) {
  const session = await getActiveSession();
  if (session?.user.emailVerifiedAt) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const { token, error, success, status, email: paramEmail } = params;

  // Auto-verify if token is present
  if (token) {
    await verifyEmailAction(token);
  }

  const errorMessage =
    error === "missing_token"
      ? "Verification link is missing a token. Please use the link from your email."
      : error === "invalid_token"
        ? "This verification link is invalid or has already been used."
        : error === "token_expired"
          ? "This verification link has expired. Request a new one below."
          : error === "verification_failed"
            ? "Something went wrong during verification. Please try again."
            : error === "email_config_missing"
              ? "Email verification is not configured. Please contact support."
              : error === "verification_setup_failed"
                ? "Failed to set up email verification. Please try signing up again."
                : error === "missing_email"
                  ? "Please enter your email address."
                  : error === "email_not_found"
                    ? "No account found with that email."
                    : error === "resend_failed"
                      ? "Failed to resend verification email. Please try again."
                      : null;

  const successMessage =
    success === "already_verified"
      ? "Your email has already been verified!"
      : success === "email_resent"
        ? "Verification email sent! Check your inbox."
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

        {isPending ? (
          <div className="panel auth-card" style={{ textAlign: "center" }}>
            <p style={{ marginTop: 0 }}>We've sent a verification link to your email.</p>
            <p style={{ fontSize: "0.95rem", color: "#666" }}>
              Click the link in your email to verify your account and get started.
            </p>
            <p style={{ fontSize: "0.85rem", color: "#999", marginBottom: "1.5rem" }}>
              The link expires in 24 hours.
            </p>

            <div style={{ borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>Didn't receive the email?</p>
              <form action={resendVerificationEmail} style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  defaultValue={paramEmail || ""}
                  required
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "0.9rem",
                  }}
                />
                <button
                  type="submit"
                  className="form-primary"
                  style={{ whiteSpace: "nowrap" }}
                >
                  Resend
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="panel auth-card" style={{ textAlign: "center" }}>
            <p style={{ marginTop: 0 }}>Email verification</p>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1.5rem" }}>
              If you have a verification link, paste it in your browser's address bar or use the form below.
            </p>

            <div style={{ borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>Resend verification email:</p>
              <form action={resendVerificationEmail} style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  defaultValue={paramEmail || ""}
                  required
                  autoComplete="email"
                  style={{
                    padding: "0.5rem",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "0.9rem",
                  }}
                />
                <button type="submit" className="form-primary">
                  Resend Verification Email
                </button>
              </form>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link href="/login" style={{ color: "#1976d2", textDecoration: "none" }}>
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
