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
  const language = String(formData.get("language") ?? "NO");
  const displayCurrency = parseCurrency(formData.get("displayCurrency")) ?? "USD";
  const baseCurrency = parseCurrency(formData.get("baseCurrency")) ?? "USD";
  const defaultAlertDays = clampAlertDays(formData.get("defaultAlertDays"), 30);

  await prisma.company.upsert({
    where: { id: companyId },
    update: {},
    create: { id: companyId, name: "Demo AS" },
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
  const { t, language } = getTranslations(settings?.language);
  const saveLabel = t("save") || (language === "NO" ? "Lagre" : "Save");

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
        labels={{
          language: t("language"),
          displayCurrency: t("displayCurrency"),
          baseCurrency: t("baseCurrency"),
          alertDays: t("alertDays"),
          theme: language === "NO" ? "Tema" : "Theme",
          save: saveLabel,
          system: "System",
          light: "Light",
          dark: "Dark",
        }}
      />
    </div>
  );
  });
}
