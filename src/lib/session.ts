import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveSession, isAuthRequired } from "@/lib/auth";

export const COMPANY_COOKIE = "kk_company";

export async function getCompanyId(): Promise<string | null> {
  const session = await getActiveSession();
  if (session) {
    return session.companyId;
  }
  if (isAuthRequired()) {
    return null;
  }
  const store = await cookies();
  return store.get(COMPANY_COOKIE)?.value ?? null;
}

export async function requireCompanyId(): Promise<string> {
  const session = await getActiveSession();
  if (session) {
    // Check if email is verified for authenticated users
    if (!session.user.emailVerifiedAt) {
      redirect("/verify-email?status=check_email");
    }
    return session.companyId;
  }
  if (isAuthRequired()) {
    redirect("/login");
  }
  const companyId = await getCompanyId();
  if (!companyId) {
    redirect("/select-company");
  }
  return companyId;
}
