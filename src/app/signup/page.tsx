import Link from "next/link";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, getActiveSession, isAuthRequired } from "@/lib/auth";
import { prepareEmailVerification, sendVerificationEmail } from "@/lib/email-verification";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanName(value: FormDataEntryValue | null) {
  const name = String(value ?? "").trim();
  return name ? name.slice(0, 80) : null;
}

async function signUp(formData: FormData) {
  "use server";

  const name = cleanName(formData.get("name"));
  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) redirect("/signup?error=missing_signup");
  if (password.length < 8) redirect("/signup?error=weak_password");

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) redirect("/signup?error=email_exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const workspaceName = name ? `${name}'s workspace` : `${email.split("@")[0]}'s workspace`;

  let user: { id: string; companyId: string; name: string | null };
  try {
    user = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: workspaceName,
          timezone: "Europe/Oslo",
          settings: {
            create: {
              language: "EN",
              displayCurrency: "USD",
              baseCurrency: "USD",
              defaultAlertDays: 30,
            },
          },
        },
        select: { id: true },
      });

      return tx.user.create({
        data: { email, name, passwordHash, companyId: company.id },
        select: { id: true, companyId: true, name: true },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/signup?error=email_exists");
    }
    throw error;
  }

  try {
    const verificationCode = await prepareEmailVerification(user.id);
    const emailResult = await sendVerificationEmail({
      email,
      name,
      token: verificationCode,
    });

    if (!emailResult.ok) {
      console.error("Failed to send verification email:", emailResult.reason);
      if (emailResult.reason === "missing_config") {
        redirect("/verify-email?error=email_config_missing");
      }
      redirect("/verify-email?error=send_failed");
    }
  } catch (error) {
    console.error("Error during email verification setup:", error);
    redirect("/verify-email?error=verification_setup_failed");
  }

  redirect(`/verify-email?status=check_email&email=${encodeURIComponent(email)}`);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  if (!isAuthRequired()) redirect("/select-company");
  const session = await getActiveSession();
  if (session) redirect("/dashboard");

  const { error } = searchParams ? await searchParams : {};
  const errorMessage =
    error === "missing_signup"
      ? "Enter your email and password."
      : error === "weak_password"
        ? "Use at least 8 characters for your password."
        : error === "email_exists"
          ? "You already have an account with that email. Please log in instead."
          : error === "oauth_missing_config"
            ? "Social signup is not configured yet."
            : error === "oauth_invalid_state"
              ? "Signup expired. Please try again."
              : error === "oauth_unverified_email"
                ? "Use an account with a verified email address."
                : error === "oauth_failed"
                  ? "Social signup failed. Please try again."
                : error === "email_config_missing"
                  ? "Email verification is not configured. Please contact support."
                : error === "send_failed"
                  ? "Unable to send verification code to your email. Please try again later."
          : null;

  return (
    <div className="page auth-page">
      <div className="page-header">
        <p className="eyebrow">DueKeeper</p>
        <h1 className="page-title">Create your account</h1>
        <p className="muted">Start with a private empty workspace. Your data is separate from every other user.</p>
      </div>

      <form action={signUp} className="panel auth-card">
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
          <span>Name</span>
          <input name="name" type="text" autoComplete="name" placeholder="Your name" />
        </label>
        <label className="stack">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="stack">
          <span>Password</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <button type="submit" className="form-primary">Create account</button>
        <p className="auth-links">Already have an account? <Link href="/login">Log in</Link></p>
      </form>
    </div>
  );
}
