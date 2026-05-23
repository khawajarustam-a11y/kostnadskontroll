import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppUrl, signInWithVerifiedEmail } from "@/lib/oauth-signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_AUTH_STATE_COOKIE = "dk_google_auth_state";
const SECURE_COOKIE = process.env.NODE_ENV === "production";

type GoogleTokenResponse = {
  access_token: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function getGoogleAuthRedirectUri() {
  return `${getAppUrl()}/api/auth/google/callback`;
}

async function exchangeCodeForToken(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: getGoogleAuthRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Could not exchange Google OAuth code");
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Could not load Google user info");
  }

  return response.json() as Promise<GoogleUserInfo>;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const savedState = store.get(GOOGLE_AUTH_STATE_COOKIE)?.value;

  store.set(GOOGLE_AUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    maxAge: 0,
  });

  if (!code || !state || !savedState || state !== savedState) {
    redirect("/login?error=oauth_invalid_state");
  }

  try {
    const token = await exchangeCodeForToken(code);
    const profile = await getGoogleUserInfo(token.access_token);
    if (!profile.email || !profile.email_verified) {
      redirect("/login?error=oauth_unverified_email");
    }

    const result = await signInWithVerifiedEmail({
      email: profile.email,
      name: profile.name,
    });

    if (!result.ok) {
      redirect("/login?error=invalid_login");
    }
  } catch {
    redirect("/login?error=oauth_failed");
  }

  redirect("/dashboard");
}
