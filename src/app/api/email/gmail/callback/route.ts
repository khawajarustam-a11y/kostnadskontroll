import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getGmailRedirectUri, GoogleTokenResponse, GoogleUserInfo } from "@/lib/gmail-oauth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secret-box";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GMAIL_STATE_COOKIE = "kk_gmail_oauth_state";
const SECURE_COOKIE = process.env.NODE_ENV === "production";

async function exchangeCodeForTokens(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: getGmailRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Could not exchange Gmail OAuth code");
  }
  return response.json() as Promise<GoogleTokenResponse>;
}

async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Could not load Gmail user info");
  }
  return response.json() as Promise<GoogleUserInfo>;
}

export async function GET(request: Request) {
  const session = await requireSession();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const savedState = store.get(GMAIL_STATE_COOKIE)?.value;

  store.set(GMAIL_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    maxAge: 0,
  });

  if (!code || !state || !savedState || state !== savedState) {
    redirect("/import?status=gmail_invalid_state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const userInfo = await getGoogleUserInfo(tokens.access_token);
    const email = userInfo.email?.trim().toLowerCase();
    if (!email) {
      redirect("/import?status=gmail_connect_failed");
    }

    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;
    const encryptedAccessToken = encryptSecret(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null;

    await prisma.emailConnection.upsert({
      where: {
        userId_provider_email: {
          userId: session.userId,
          provider: "gmail",
          email,
        },
      },
      update: {
        companyId: session.companyId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        scope: tokens.scope,
        expiresAt,
      },
      create: {
        companyId: session.companyId,
        userId: session.userId,
        provider: "gmail",
        email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        scope: tokens.scope,
        expiresAt,
      },
    });
  } catch {
    redirect("/import?status=gmail_connect_failed");
  }

  redirect("/import?status=gmail_connected");
}
