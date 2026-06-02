import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSession, getActiveSession, isAuthRequired } from "@/lib/auth";
import { getTranslations } from "@/lib/i18n";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prepareEmailVerification, sendVerificationEmail } from "@/lib/email-verification";

export const runtime = "nodejs";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) redirect("/login?error=missing_login");

  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: { select: { deletedAt: true } } },
  });
  if (!user || user.deletedAt || user.company.deletedAt) redirect("/login?error=invalid_login");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) redirect("/login?error=invalid_login");

  if (!user.emailVerifiedAt) {
    try {
      const verificationCode = await prepareEmailVerification(user.id);
      const emailResult = await sendVerificationEmail({
        email: user.email,
        name: user.name,
        token: verificationCode,
      });

      if (!emailResult.ok) {
        console.error("Failed to send verification email during login:", emailResult.reason);
        if (emailResult.reason === "missing_config") {
          redirect("/login?error=email_config_missing");
        }
        redirect("/login?error=send_failed");
      }
    } catch (error) {
      console.error("Error sending verification email during login:", error);
      redirect("/login?error=send_failed");
    }

    redirect("/verify-email?status=check_email&email=" + encodeURIComponent(email));
  }

  await createSession({ userId: user.id, companyId: user.companyId });
  redirect("/dashboard");
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  if (!isAuthRequired()) redirect("/select-company");
  const session = await getActiveSession();
  if (session) redirect("/dashboard");

  const defaultLanguage = process.env.DEFAULT_LANGUAGE === "NO" ? "NO" : "EN";
  const { t } = getTranslations(defaultLanguage);
  const signInLabel = t("signIn") || "Sign in";
  const { error } = searchParams ? await searchParams : {};
  const errorMessage =
    error === "missing_login"
      ? t("errorMissingLogin")
      : error === "invalid_login"
        ? t("errorInvalidLogin")
        : error === "oauth_missing_config"
          ? "Social login is not configured yet."
          : error === "oauth_invalid_state"
            ? "Login expired. Please try again."
            : error === "oauth_unverified_email"
              ? "Use an account with a verified email address."
              : error === "oauth_failed"
                ? "Social login failed. Please try again."
                : error === "email_config_missing"
                  ? "Email verification is not configured. Please contact support."
                : error === "send_failed"
                  ? "Unable to send the verification code. Please try again later."
                : null;

  return (
    <div className="page auth-page">
      <div className="page-header">
        <p className="eyebrow">DueKeeper</p>
        <h1 className="page-title">{t("login")}</h1>
        <p className="muted">Log in to your private workspace.</p>
      </div>
      <form action={login} className="panel auth-card">
        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        <div className="oauth-actions">
          <Link className="oauth-button" href="/api/auth/google/start">
            <span className="oauth-mark" aria-hidden="true">G</span>
            Continue with Google
          </Link>
          <Link className="oauth-button" href="/api/auth/github/start">
            <span className="oauth-mark" aria-hidden="true">GH</span>
            Continue with GitHub
          </Link>
        </div>
        <div className="auth-divider"><span>or</span></div>
        <label className="stack">
          <span>{t("email")}</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="stack">
          <span>{t("password")}</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" className="form-primary">{signInLabel}</button>
        <p className="auth-links">
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
        <p className="auth-links">New to DueKeeper? <Link href="/signup">Create an account</Link></p>
      </form>
    </div>
  );
}
