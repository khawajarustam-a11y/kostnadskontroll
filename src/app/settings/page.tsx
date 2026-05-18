import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getTranslations, type Language } from "@/lib/i18n";
import type { Currency } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { requireCompanyId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import SettingsForm from "@/components/SettingsForm";
import { withRequestContext, withTiming } from "@/lib/observability";
import { clampAlertDays, parseCurrency } from "@/lib/validation";
import { getSettingsCached } from "@/lib/cached-data";

export const runtime = "nodejs";

const DELETE_WINDOW_DAYS = 30;
const DELETE_WINDOW_MS = DELETE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanName(value: FormDataEntryValue | null) {
  const name = String(value ?? "").trim();
  return name ? name.slice(0, 80) : null;
}

function accountMessage(code?: string) {
  switch (code) {
    case "updated":
      return "Account updated.";
    case "delete_requested":
      return "Account deletion is scheduled. You can restore it within 30 days.";
    case "restored":
      return "Account restored.";
    case "missing_email":
      return "Email is required.";
    case "current_password_required":
      return "Enter your current password to change email or password.";
    case "current_password_wrong":
      return "Current password is wrong.";
    case "weak_password":
      return "Use at least 8 characters for the new password.";
    case "email_exists":
      return "That email is already used by another account.";
    case "confirm_delete":
      return "Type DELETE to confirm account deletion.";
    default:
      return null;
  }
}

async function updateSettings(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const language = String(formData.get("language") ?? "EN");
  const displayCurrency = parseCurrency(formData.get("displayCurrency")) ?? "USD";
  const baseCurrency = parseCurrency(formData.get("baseCurrency")) ?? "USD";
  const defaultAlertDays = clampAlertDays(formData.get("defaultAlertDays"), 30);
  const timezone = String(formData.get("timezone") ?? "Europe/Oslo");

  await prisma.company.upsert({
    where: { id: companyId },
    update: { timezone },
    create: { id: companyId, name: "Workspace", timezone },
  });

  await prisma.settings.upsert({
    where: { companyId },
    update: { language, displayCurrency, baseCurrency, defaultAlertDays },
    create: { companyId, language, displayCurrency, baseCurrency, defaultAlertDays },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/costs");
  revalidatePath("/contracts");
  redirect("/settings");
}

async function updateAccount(formData: FormData) {
  "use server";
  const session = await requireSession();
  const name = cleanName(formData.get("name"));
  const email = cleanEmail(formData.get("email"));
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!email) redirect("/settings?account=missing_email");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, passwordHash: true, deletedAt: true },
  });
  if (!user || user.deletedAt) redirect("/login");

  const changingEmail = email !== user.email;
  const changingPassword = newPassword.length > 0;

  if (changingPassword && newPassword.length < 8) redirect("/settings?account=weak_password");

  if (changingEmail || changingPassword) {
    if (!currentPassword) redirect("/settings?account=current_password_required");
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) redirect("/settings?account=current_password_wrong");
  }

  if (changingEmail) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && existing.id !== session.userId) redirect("/settings?account=email_exists");
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      name,
      email,
      ...(changingPassword ? { passwordHash: await bcrypt.hash(newPassword, 12) } : {}),
    },
  });

  revalidatePath("/settings");
  redirect("/settings?account=updated");
}

async function requestAccountDeletion(formData: FormData) {
  "use server";
  const session = await requireSession();
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "DELETE") redirect("/settings?account=confirm_delete");

  const now = new Date();
  const scheduled = new Date(now.getTime() + DELETE_WINDOW_MS);

  await prisma.$transaction([
    prisma.company.update({
      where: { id: session.companyId },
      data: { deleteRequestedAt: now, deleteScheduledAt: scheduled },
    }),
    prisma.user.updateMany({
      where: { companyId: session.companyId },
      data: { deleteRequestedAt: now, deleteScheduledAt: scheduled },
    }),
  ]);

  revalidatePath("/settings");
  redirect("/settings?account=delete_requested");
}

async function restoreAccount() {
  "use server";
  const session = await requireSession();

  await prisma.$transaction([
    prisma.company.update({
      where: { id: session.companyId },
      data: { deleteRequestedAt: null, deleteScheduledAt: null, deletedAt: null },
    }),
    prisma.user.updateMany({
      where: { companyId: session.companyId },
      data: { deleteRequestedAt: null, deleteScheduledAt: null, deletedAt: null },
    }),
  ]);

  revalidatePath("/settings");
  redirect("/settings?account=restored");
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string }>;
}) {
  const companyId = await requireCompanyId();
  const session = await requireSession();
  const { account } = searchParams ? await searchParams : {};

  return withRequestContext({ route: "/settings", companyId }, async () => {
    const settings = await withTiming("settings.load", () => getSettingsCached(companyId));
    const company = await withTiming("settings.company", () =>
      prisma.company.findUnique({
        where: { id: companyId },
        select: { timezone: true, deleteScheduledAt: true },
      })
    );
    const user = await withTiming("settings.user", () =>
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true, deleteScheduledAt: true },
      })
    );
    const { t, language } = getTranslations(settings?.language);
    const saveLabel = t("save") || (language === "NO" ? "Lagre" : "Save");
    const reminderConfigured = Boolean(
      process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL && process.env.CRON_SECRET
    );
    const reminderNeeds = [
      !process.env.RESEND_API_KEY ? "RESEND_API_KEY" : null,
      !process.env.REMINDER_FROM_EMAIL ? "REMINDER_FROM_EMAIL" : null,
      !process.env.CRON_SECRET ? "CRON_SECRET" : null,
    ].filter((item): item is string => Boolean(item));
    const formLanguage = (settings?.language ?? "EN") as Language;
    const formDisplayCurrency = (settings?.displayCurrency ?? "USD") as Currency;
    const formBaseCurrency = (settings?.baseCurrency ?? "USD") as Currency;
    const message = accountMessage(account);
    const deleteScheduledAt = user?.deleteScheduledAt ?? company?.deleteScheduledAt ?? null;
    const deleteDate = deleteScheduledAt
      ? deleteScheduledAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : null;

    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{t("settings")}</h1>
          <p className="muted">{t("settingsSubtitle")}</p>
        </div>

        <SettingsForm
          action={updateSettings}
          language={formLanguage}
          displayCurrency={formDisplayCurrency}
          baseCurrency={formBaseCurrency}
          defaultAlertDays={settings?.defaultAlertDays ?? 30}
          timezone={company?.timezone ?? "Europe/Oslo"}
          labels={{
            language: "Language",
            displayCurrency: "Display currency",
            baseCurrency: "Base currency",
            alertDays: "Alert days",
            timezone: "Timezone",
            theme: "Theme",
            save: saveLabel,
            system: "System",
            light: "Light",
            dark: "Dark",
          }}
        />

        <section className="panel account-panel">
          <div>
            <p className="eyebrow">Account</p>
            <h2 className="section-title">Profile and security</h2>
            <p className="muted">Change your name, email, or password. Your workspace data stays private to your account.</p>
          </div>

          {message ? <p className="account-message">{message}</p> : null}

          <form action={updateAccount} className="account-grid">
            <label className="stack">
              <span>Name</span>
              <input name="name" type="text" defaultValue={user?.name ?? ""} autoComplete="name" />
            </label>
            <label className="stack">
              <span>Email</span>
              <input name="email" type="email" defaultValue={user?.email ?? ""} autoComplete="email" required />
            </label>
            <label className="stack">
              <span>Current password</span>
              <input name="currentPassword" type="password" autoComplete="current-password" placeholder="Required for email or password changes" />
            </label>
            <label className="stack">
              <span>New password</span>
              <input name="newPassword" type="password" autoComplete="new-password" placeholder="Optional" minLength={8} />
            </label>
            <div className="account-actions full-row">
              <button type="submit" className="form-primary">Save account changes</button>
            </div>
          </form>

          <div className="danger-zone">
            <div>
              <h3>Delete account</h3>
              <p>
                Schedule your account for deletion. You can restore it for {DELETE_WINDOW_DAYS} days. After that, your contracts, costs, accounting entries, imports, and settings are permanently removed.
              </p>
            </div>
            {deleteDate ? (
              <div className="account-actions">
                <p className="account-message">Deletion scheduled for {deleteDate}.</p>
                <form action={restoreAccount}>
                  <button type="submit" className="secondary-button">Restore account</button>
                </form>
              </div>
            ) : (
              <form action={requestAccountDeletion} className="account-actions">
                <input name="confirm" placeholder="Type DELETE to confirm" aria-label="Type DELETE to confirm" />
                <button type="submit" className="danger-button">Schedule account deletion</button>
              </form>
            )}
          </div>
        </section>

        <section className="panel automation-status-panel">
          <div>
            <p className="eyebrow">{t("automation")}</p>
            <h2 className="section-title">{t("emailReminderAutomation")}</h2>
            <p className="muted">{t("emailReminderAutomationText")}</p>
          </div>
          <div className={reminderConfigured ? "automation-status automation-status-on" : "automation-status automation-status-off"}>
            <span className={reminderConfigured ? "badge badge-safe" : "badge badge-warning"}>
              {reminderConfigured ? t("active") : t("notConfigured")}
            </span>
            {reminderNeeds.length > 0 ? (
              <p>{t("missingVariables")}: {reminderNeeds.join(", ")}</p>
            ) : (
              <p>{t("readyToSendReminders")}</p>
            )}
          </div>
        </section>
      </div>
    );
  });
}
