import { prisma } from "@/lib/prisma";
import { createSession, getSession, isAuthRequired } from "@/lib/auth";
import { getTranslations } from "@/lib/i18n";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    redirect("/login?error=missing_login");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    redirect("/login?error=invalid_login");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    redirect("/login?error=invalid_login");
  }

  await createSession({ userId: user.id, companyId: user.companyId });
  redirect("/dashboard");
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  if (!isAuthRequired()) {
    redirect("/select-company");
  }
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  const defaultLanguage = process.env.DEFAULT_LANGUAGE === "NO" ? "NO" : "EN";
  const { t } = getTranslations(defaultLanguage);
  const signInLabel = t("signIn") || "Logg inn";
  const { error } = searchParams ? await searchParams : {};
  const errorMessage = error === "missing_login"
    ? t("errorMissingLogin")
    : error === "invalid_login"
      ? t("errorInvalidLogin")
      : null;

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <h1 className="page-title">{t("login")}</h1>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <form action={login} className="stack">
        <label className="stack">
          <span>{t("email")}</span>
          <input name="email" type="email" required />
        </label>
        <label className="stack">
          <span>{t("password")}</span>
          <input name="password" type="password" required />
        </label>
        <button type="submit" className="form-primary">
          {signInLabel}
        </button>
      </form>
    </div>
  );
}

