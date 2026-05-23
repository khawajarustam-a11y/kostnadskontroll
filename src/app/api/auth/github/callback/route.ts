import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppUrl, signInWithVerifiedEmail } from "@/lib/oauth-signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GITHUB_AUTH_STATE_COOKIE = "dk_github_auth_state";
const SECURE_COOKIE = process.env.NODE_ENV === "production";

type GitHubTokenResponse = {
  access_token?: string;
};

type GitHubUser = {
  name?: string | null;
  email?: string | null;
  login?: string;
};

type GitHubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
};

function getGitHubAuthRedirectUri() {
  return `${getAppUrl()}/api/auth/github/callback`;
}

async function exchangeCodeForToken(code: string) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      redirect_uri: getGitHubAuthRedirectUri(),
    }),
  });

  if (!response.ok) {
    throw new Error("Could not exchange GitHub OAuth code");
  }

  return response.json() as Promise<GitHubTokenResponse>;
}

async function getGitHubUser(accessToken: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error("Could not load GitHub user");
  }

  return response.json() as Promise<GitHubUser>;
}

async function getGitHubEmails(accessToken: string) {
  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error("Could not load GitHub emails");
  }

  return response.json() as Promise<GitHubEmail[]>;
}

function pickVerifiedEmail(user: GitHubUser, emails: GitHubEmail[]) {
  const primaryEmail = emails.find((email) => email.primary && email.verified)?.email;
  const firstVerifiedEmail = emails.find((email) => email.verified)?.email;
  return primaryEmail ?? firstVerifiedEmail ?? user.email ?? null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const savedState = store.get(GITHUB_AUTH_STATE_COOKIE)?.value;

  store.set(GITHUB_AUTH_STATE_COOKIE, "", {
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
    if (!token.access_token) {
      redirect("/login?error=oauth_failed");
    }

    const [user, emails] = await Promise.all([
      getGitHubUser(token.access_token),
      getGitHubEmails(token.access_token),
    ]);
    const email = pickVerifiedEmail(user, emails);

    if (!email) {
      redirect("/login?error=oauth_unverified_email");
    }

    const result = await signInWithVerifiedEmail({
      email,
      name: user.name || user.login,
    });

    if (!result.ok) {
      redirect("/login?error=invalid_login");
    }
  } catch {
    redirect("/login?error=oauth_failed");
  }

  redirect("/dashboard");
}
