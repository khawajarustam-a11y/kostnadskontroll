import { prisma } from "@/lib/prisma";
import { getTranslations } from "@/lib/i18n";
import { requireCompanyId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import SettingsForm from "@/components/SettingsForm";
import { withRequestContext, withTiming } from "@/lib/observability";
import { clampAlertDays, parseCurrency } from "@/lib/validation";
import { getSettingsCached } from "@/lib/cached-data";

export const runtime = "nodejs";

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
    create: { id: companyId, name: "Demo AS", timezone },
  });

  await prisma.settings.upsert({
    where: { companyId },
    update: {
      language,
      displayCurrency,
      baseCurrency,
      defaultAlertDays,
    },
    create: {
      companyId,
      language,
      displayCurrency,
      baseCurrency,
      defaultAlertDays,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/costs");
  revalidatePath("/contracts");
  redirect("/settings");
}

export default async function Page() {
  const companyId = await requireCompanyId();
  return withRequestContext({ route: "/settings", companyId }, async () => {
  const settings = await withTiming("settings.load", () =>
    getSettingsCached(companyId)
  );
  const company = await withTiming("settings.company", () =>
    prisma.company.findUnique({ where: { id: companyId }, select: { timezone: true } })
  );
  const { t, language } = getTranslations(settings?.language);
  const saveLabel = t("save") || (language === "NO" ? "Lagre" : "Save");
  const reminderConfigured = Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL && process.env.CRON_SECRET);
  const reminderNeeds = [
    !process.env.RESEND_API_KEY ? "RESEND_API_KEY" : null,
    !process.env.REMINDER_FROM_EMAIL ? "REMINDER_FROM_EMAIL" : null,
    !process.env.CRON_SECRET ? "CRON_SECRET" : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t("settings")}</h1>
        <p className="muted">{t("settingsSubtitle")}</p>
      </div>
      <SettingsForm
        action={updateSettings}
        language={language}
        displayCurrency={settings?.displayCurrency ?? "USD"}
        baseCurrency={settings?.baseCurrency ?? "USD"}
        defaultAlertDays={settings?.defaultAlertDays ?? 30}
        timezone={company?.timezone ?? "Europe/Oslo"}
        labels={{
          language: t("language"),
          displayCurrency: t("displayCurrency"),
          baseCurrency: t("baseCurrency"),
          alertDays: t("alertDays"),
          timezone: t("timezone"),
          theme: language === "NO" ? "Tema" : "Theme",
          save: saveLabel,
          system: "System",
          light: "Light",
          dark: "Dark",
        }}
      />

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
          {reminderNeeds.length > 0 ? <p>{t("missingVariables")}: {reminderNeeds.join(", ")}</p> : <p>{t("readyToSendReminders")}</p>}
        </div>
      </section>
    </div>
  );
  });
}
