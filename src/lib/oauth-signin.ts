import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export type OAuthProfile = {
  email: string;
  name?: string | null;
};

export function getAppUrl() {
  return process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function signInWithVerifiedEmail(profile: OAuthProfile) {
  const email = profile.email.trim().toLowerCase();
  const name = profile.name?.trim().slice(0, 80) || null;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { company: { select: { deletedAt: true } } },
  });

  if (existingUser) {
    if (existingUser.deletedAt || existingUser.company.deletedAt) {
      return { ok: false as const };
    }
    await createSession({ userId: existingUser.id, companyId: existingUser.companyId });
    return { ok: true as const };
  }

  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
  const workspaceName = name ? `${name}'s workspace` : `${email.split("@")[0]}'s workspace`;

  const user = await prisma.$transaction(async (tx) => {
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
      select: { id: true, companyId: true },
    });
  });

  await createSession({ userId: user.id, companyId: user.companyId });
  return { ok: true as const };
}
