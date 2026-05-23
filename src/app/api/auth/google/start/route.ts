import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/oauth-signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_AUTH_STATE_COOKIE = "dk_google_auth_state";
const SECURE_COOKIE = process.env.NODE_ENV === "production";

function getGoogleAuthRedirectUri() {
  return `${getAppUrl()}/api/auth/google/callback`;
}

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    redirect("/login?error=oauth_missing_config");
  }

  const state = crypto.randomUUID();
  const store = await cookies();
  store.set(GOOGLE_AUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    maxAge: 60 * 10,
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", getGoogleAuthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  redirect(url.toString());
}
