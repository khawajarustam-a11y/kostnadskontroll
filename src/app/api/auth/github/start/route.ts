import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/oauth-signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GITHUB_AUTH_STATE_COOKIE = "dk_github_auth_state";
const SECURE_COOKIE = process.env.NODE_ENV === "production";

function getGitHubAuthRedirectUri() {
  return `${getAppUrl()}/api/auth/github/callback`;
}

export async function GET() {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    redirect("/login?error=oauth_missing_config");
  }

  const state = crypto.randomUUID();
  const store = await cookies();
  store.set(GITHUB_AUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    maxAge: 60 * 10,
  });

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", getGitHubAuthRedirectUri());
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);

  redirect(url.toString());
}
