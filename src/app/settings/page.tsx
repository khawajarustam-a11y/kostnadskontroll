import { prisma } from "@/lib/prisma";
import { getTranslations } from "@/lib/i18n";
import { requireCompanyId } from "@/lib/session";
import { Currency } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ThemeModeSelect from "@/components/ThemeModeSelect";
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
  const updateLabel =
    t("updateSettings") ||
    (language === "NO" ? "Oppdater innstillinger" : "Update settings");

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t("settings")}</h1>
        <p className="muted">{t("settingsSubtitle")}</p>
      </div>
      <form action={updateSettings} className="panel stack">
        <div className="settings-grid">
          <label className="stack">
            <span>{t("language")}</span>
            <select name="language" defaultValue={language}>
              <option value="NO">NO</option>
              <option value="EN">EN</option>
            </select>
          </label>
          <label className="stack">
            <span>{t("displayCurrency")}</span>
            <select
              name="displayCurrency"
              defaultValue={settings?.displayCurrency ?? "USD"}
            >
              <option value="USD">USD</option>
              <option value="NOK">NOK</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="stack">
            <span>{t("baseCurrency")}</span>
            <select
              name="baseCurrency"
              defaultValue={settings?.baseCurrency ?? "USD"}
            >
              <option value="USD">USD</option>
              <option value="NOK">NOK</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="stack">
            <span>{t("alertDays")}</span>
            <input
              name="defaultAlertDays"
              type="number"
              min="1"
              defaultValue={settings?.defaultAlertDays ?? 30}
            />
          </label>
          <ThemeModeSelect
            label={language === "NO" ? "Tema" : "Theme"}
            systemLabel="System"
            lightLabel="Light"
            darkLabel="Dark"
          />
        </div>
        <div className="form-actions">
          <button
            type="submit"
            className="form-primary"
            aria-label={updateLabel || "Update settings"}
          >
            {updateLabel || (language === "NO" ? "Oppdater innstillinger" : "Update settings")}
          </button>
        </div>
      </form>
    </div>
  );
  });
}
