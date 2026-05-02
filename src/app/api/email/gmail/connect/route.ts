import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { buildGmailAuthUrl, isGmailOAuthConfigured } from "@/lib/gmail-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GMAIL_STATE_COOKIE = "kk_gmail_oauth_state";

export async function GET() {
  await requireSession();
  if (!isGmailOAuthConfigured()) {
    redirect("/import?status=gmail_missing_config");
  }

  const state = crypto.randomUUID();
  const store = await cookies();
  store.set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  redirect(buildGmailAuthUrl(state).toString());
}
