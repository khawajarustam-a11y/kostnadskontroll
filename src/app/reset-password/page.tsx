import Link from "next/link";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashEmailVerificationToken } from "@/lib/email-verification";
import { createSession, getActiveSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanCode(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function resetPassword(formData: FormData) {
  "use server";

  const email = cleanEmail(formData.get("email"));
  const code = cleanCode(formData.get("code"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !code || !password || !confirmPassword) {
    redirect(`/reset-password?error=missing_fields&email=${encodeURIComponent(email)}`);
  }

  if (password.length < 8) {
    redirect(`/reset-password?error=weak_password&email=${encodeURIComponent(email)}`);
  }

  if (password !== confirmPassword) {
    redirect(`/reset-password?error=password_mismatch&email=${encodeURIComponent(email)}`);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      companyId: true,
      passwordResetTokenHash: true,
      passwordResetTokenExpiresAt: true,
    },
  });

  if (!user || !user.passwordResetTokenHash || !user.passwordResetTokenExpiresAt) {
    redirect(`/reset-password?error=invalid_request&email=${encodeURIComponent(email)}`);
  }

  if (new Date() > user.passwordResetTokenExpiresAt) {
    redirect(`/reset-password?error=code_expired&email=${encodeURIComponent(email)}`);
  }

  if (hashEmailVerificationToken(code) !== user.passwordResetTokenHash) {
    redirect(`/reset-password?error=invalid_code&email=${encodeURIComponent(email)}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    },
  });

  await createSession({ userId: user.id, companyId: user.companyId });
  redirect("/dashboard");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; status?: string; email?: string }>;
}) {
  const session = await getActiveSession();
  if (session) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const { error, status, email: paramEmail } = params;

  const errorMessage =
    error === "missing_fields"
      ? "Fill in all fields to reset your password."
      : error === "weak_password"
        ? "Use at least 8 characters for your password."
        : error === "password_mismatch"
          ? "The passwords do not match."
          : error === "invalid_request"
            ? "The reset request is invalid. Request a new code."
            : error === "code_expired"
              ? "This code has expired. Request a new reset code."
              : error === "invalid_code"
                ? "The code is invalid. Please check your email."
                : null;

  const successMessage =
    status === "sent"
      ? "We sent a password reset code to your email."
      : null;

  return (
    <div className="page auth-page">
      <div className="page-header">
        <p className="eyebrow">DueKeeper</p>
        <h1 className="page-title">Reset Password</h1>
        <p className="muted">Enter the 6-digit code from your email and choose a new password.</p>
      </div>

      <form action={resetPassword} className="panel auth-card">
        {successMessage ? <p className="form-success">{successMessage}</p> : null}
        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        <label className="stack">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" defaultValue={paramEmail || ""} required />
        </label>
        <label className="stack">
          <span>Reset Code</span>
          <input name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" required />
        </label>
        <label className="stack">
          <span>New Password</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="stack">
          <span>Confirm Password</span>
          <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <button type="submit" className="form-primary">Reset password</button>
        <p className="auth-links">
          Remembered your password? <Link href="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
