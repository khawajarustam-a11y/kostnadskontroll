import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const VERIFICATION_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getVerificationAppUrl() {
  return (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function prepareEmailVerification(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationTokenHash: hashEmailVerificationToken(token),
      emailVerificationTokenExpiresAt: new Date(Date.now() + VERIFICATION_MAX_AGE_MS),
    },
  });
  return token;
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

  const verifyUrl = `${getVerificationAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
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
      subject: "Verify your DueKeeper email",
      text: `Hi ${name?.trim() || "there"},\n\nVerify your DueKeeper email here:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
      html: `<p>Hi ${safeName},</p><p>Verify your DueKeeper email by clicking the link below.</p><p><a href="${verifyUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    }),
  });

  if (!response.ok) {
    return { ok: false as const, reason: "send_failed" as const };
  }

  return { ok: true as const };
}
