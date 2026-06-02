import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type SessionPayload = {
  userId: string;
  companyId: string;
};

export type ActiveSessionData = SessionPayload & {
  user: {
    id: string;
    emailVerifiedAt: Date | null;
  };
};

const SESSION_COOKIE = "kk_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const AUTH_REQUIRED = process.env.AUTH_REQUIRED === "true";
const SECURE_COOKIE = process.env.NODE_ENV === "production";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (AUTH_REQUIRED || process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not set");
    }
    return new TextEncoder().encode("dev-secret");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
});

export const getActiveSession = cache(async (): Promise<ActiveSessionData | null> => {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      companyId: session.companyId,
      deletedAt: null,
      company: { deletedAt: null },
    },
    select: { id: true, emailVerifiedAt: true },
  });

  return user ? { ...session, user } : null;
});

export async function clearSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    maxAge: 0,
  });
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getActiveSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export function isAuthRequired(): boolean {
  return AUTH_REQUIRED;
}
