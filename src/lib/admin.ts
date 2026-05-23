import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

function parseEmailList(value?: string) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminEmails() {
  return new Set([
    ...parseEmailList(process.env.ADMIN_EMAILS),
    ...parseEmailList(process.env.FEEDBACK_TO_EMAIL),
  ]);
}

export async function isFeedbackAdmin(session: SessionPayload | null) {
  if (!session) {
    return false;
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.size === 0) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  return Boolean(user?.email && adminEmails.has(user.email.toLowerCase()));
}
