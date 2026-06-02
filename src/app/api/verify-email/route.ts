import { prisma } from "@/lib/prisma";
import { hashEmailVerificationToken } from "@/lib/email-verification";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const tokenHash = hashEmailVerificationToken(token);

    const user = await prisma.user.findFirst({
      where: { emailVerificationTokenHash: tokenHash },
      select: {
        id: true,
        email: true,
        emailVerificationTokenExpiresAt: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      return Response.json({ error: "Invalid token" }, { status: 400 });
    }

    if (user.emailVerifiedAt) {
      return Response.json({ ok: true, message: "Email already verified" });
    }

    if (!user.emailVerificationTokenExpiresAt || user.emailVerificationTokenExpiresAt < new Date()) {
      return Response.json({ error: "Token expired" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return Response.json({ ok: true, message: "Email verified successfully" });
  } catch (error) {
    console.error("Email verification error:", error);
    return Response.json({ error: "Verification failed" }, { status: 500 });
  }
}
