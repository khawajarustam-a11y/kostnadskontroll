import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

const VERIFICATION_MAX_AGE_MS = 1000 * 60 * 30;
const PASSWORD_RESET_MAX_AGE_MS = 1000 * 60 * 30;

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function generateSixDigitCode() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

export async function prepareEmailVerification(userId: string) {
  const code = generateSixDigitCode();
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationTokenHash: hashEmailVerificationToken(code),
      emailVerificationTokenExpiresAt: new Date(Date.now() + VERIFICATION_MAX_AGE_MS),
    },
  });
  return code;
}

export async function preparePasswordReset(userId: string) {
  const code = generateSixDigitCode();
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetTokenHash: hashEmailVerificationToken(code),
      passwordResetTokenExpiresAt: new Date(Date.now() + PASSWORD_RESET_MAX_AGE_MS),
    },
  });
  return code;
}

export async function sendVerificationEmail({
  email,
  name,
  token,
}: {
  email: string;
  name?: string | null;
  token: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false as const, reason: "missing_config" as const };
  }

  const safeName = escapeHtml(name?.trim() || "there");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your DueKeeper verification code",
      text: `Hi ${name?.trim() || "there"},\n\nUse this 6-digit code to verify your DueKeeper email:\n${token}\n\nThis code expires in 30 minutes.`,
      html: `<p>Hi ${safeName},</p><p>Use the code below to verify your DueKeeper email.</p><p style="font-size: 1.5rem; font-weight: 700;">${token}</p><p>This code expires in 30 minutes.</p>`,
    }),
  });

  if (!response.ok) {
    return { ok: false as const, reason: "send_failed" as const };
  }

  return { ok: true as const };
}

export async function sendPasswordResetEmail({
  email,
  name,
  token,
}: {
  email: string;
  name?: string | null;
  token: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false as const, reason: "missing_config" as const };
  }

  const safeName = escapeHtml(name?.trim() || "there");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your DueKeeper password reset code",
      text: `Hi ${name?.trim() || "there"},\n\nUse this 6-digit code to reset your DueKeeper password:\n${token}\n\nThis code expires in 30 minutes.`,
      html: `<p>Hi ${safeName},</p><p>Use the code below to reset your DueKeeper password.</p><p style="font-size: 1.5rem; font-weight: 700;">${token}</p><p>This code expires in 30 minutes.</p>`,
    }),
  });

  if (!response.ok) {
    return { ok: false as const, reason: "send_failed" as const };
  }

  return { ok: true as const };
}
