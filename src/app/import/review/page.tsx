import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Currency } from "@prisma/client";
import { SubmitButton } from "@/components/SubmitButton";
import { getSettingsCached } from "@/lib/cached-data";
import { dateInputValue, clearImportReviewDraft, getImportReviewDraft, saveReviewedImport } from "@/lib/import-review";
import { getTranslations } from "@/lib/i18n";
import { withRequestContext, withTiming } from "@/lib/observability";
import { requireCompanyId } from "@/lib/session";

export const runtime = "nodejs";

const currencies: Currency[] = ["USD", "NOK", "EUR"];

async function saveImportReview(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const draft = await getImportReviewDraft();
  if (!draft) redirect("/import?status=review_expired");

  const settings = await getSettingsCached(companyId);
  const result = await saveReviewedImport({
    companyId,
    type: draft.type,
    formData,
    defaultCurrency: settings?.displayCurrency ?? "USD",
    defaultAlertDays: settings?.defaultAlertDays ?? 30,
  });

  if (!result.ok) redirect("/import/review?status=invalid_review");
  await clearImportReviewDraft();
  revalidatePath("/dashboard");
  revalidatePath("/action-required");
  revalidatePath(result.redirectTo);
  redirect(`${result.redirectTo}?status=import_saved`);
}

async function cancelImportReview() {
  "use server";
  await clearImportReviewDraft();
  redirect("/import");
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const companyId = await requireCompanyId();
  return withRequestContext({ route: "/import/review", companyId }, async () => {
    const draft = await getImportReviewDraft();
    if (!draft) redirect("/import?status=review_expired");
    const settings = await withTiming("import-review.settings", () => getSettingsCached(companyId));
    const { t } = getTranslations(settings?.language);
    const { status } = searchParams ? await searchParams : {};
    const data = draft.data;
    const amount = data.amount ?? data.pricePerMonth ?? "";
    const currency = data.currency ?? settings?.displayCurrency ?? "USD";

    return (
      <div className="page">
        <div className="page-header">
          <p className="eyebrow">{t("automation")}</p>
          <h1 className="page-title">{t("reviewImport")}</h1>
          <p className="page-hero">{t("reviewImportHero")}</p>
          <p className="muted">{t("reviewImportSubtitle")}</p>
        </div>

        {status === "invalid_review" ? <p className="form-error">{t("reviewImportInvalid")}</p> : null}

        <section className="panel import-panel">
          <div className="panel-title">{t("extractedDetails")}</div>
          <p className="muted">{t("sourceFile")}: {draft.sourceName}</p>
          <form action={saveImportReview} className="stack">
            <div className="form-grid form-grid-3">
              <label className="field-label">
                <span>{t("name")}</span>
                <input name="name" defaultValue={data.name ?? ""} required={draft.type !== "ledger"} />
              </label>
              <label className="field-label">
                <span>{t("supplier")}</span>
                <input name="supplier" defaultValue={data.supplier ?? ""} />
              </label>
              <label className="field-label">
                <span>{t("amount")}</span>
                <input name="amount" type="number" min="0" step="0.01" defaultValue={amount} required />
              </label>
              <label className="field-label">
                <span>{t("currency")}</span>
                <select name="currency" defaultValue={currency}>
                  {currencies.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              {draft.type !== "contracts" ? (
                <label className="field-label">
                  <span>{t("category")}</span>
                  <input name="category" defaultValue={data.category ?? ""} />
                </label>
              ) : null}
              {draft.type === "costs" ? (
                <label className="field-label">
                  <span>{t("frequency")}</span>
                  <select name="frequency" defaultValue={(data.frequency ?? "MONTHLY").toUpperCase()}>
                    <option value="MONTHLY">{t("monthly")}</option>
                    <option value="YEARLY">{t("yearly")}</option>
                    <option value="WEEKLY">{t("weekly")}</option>
                  </select>
                </label>
              ) : null}
              {draft.type === "ledger" ? (
                <>
                  <label className="field-label">
                    <span>{t("entryType")}</span>
                    <select name="entryType" defaultValue={data.type ?? "EXPENSE"}>
                      <option value="EXPENSE">{t("expense")}</option>
                      <option value="INCOME">{t("income")}</option>
                    </select>
                  </label>
                  <label className="field-label field-label-wide">
                    <span>{t("description")}</span>
                    <input name="description" defaultValue={data.description ?? data.name ?? ""} />
                  </label>
                </>
              ) : null}
            </div>

            {draft.type === "contracts" ? (
              <div className="review-fieldset">
                <div className="panel-title compact-title">{t("contractDates")}</div>
                <div className="form-grid form-grid-4">
                  <label className="field-label">
                    <span>{t("startDate")}</span>
                    <input name="startDate" type="date" defaultValue={dateInputValue(data.startDate)} />
                  </label>
                  <label className="field-label">
                    <span>{t("endDate")}</span>
                    <input name="endDate" type="date" defaultValue={dateInputValue(data.endDate)} />
                  </label>
                  <label className="field-label">
                    <span>{t("renewalDate")}</span>
                    <input name="renewalDate" type="date" defaultValue={dateInputValue(data.renewalDate)} />
                  </label>
                  <label className="field-label">
                    <span>{t("cancelByDate")}</span>
                    <input name="cancelByDate" type="date" defaultValue={dateInputValue(data.cancelByDate)} />
                  </label>
                  <label className="field-label">
                    <span>{t("alertDays")}</span>
                    <input name="alertDays" type="number" min="1" max="365" defaultValue={data.alertDays ?? settings?.defaultAlertDays ?? 30} />
                  </label>
                </div>
              </div>
            ) : null}

            {draft.type === "costs" ? (
              <label className="field-label review-date-field">
                <span>{t("startDate")}</span>
                <input name="startDate" type="date" defaultValue={dateInputValue(data.startDate)} />
              </label>
            ) : null}

            {draft.type === "ledger" ? (
              <label className="field-label review-date-field">
                <span>{t("entryDate")}</span>
                <input name="entryDate" type="date" defaultValue={dateInputValue(data.entryDate ?? data.startDate)} required />
              </label>
            ) : null}

            <label className="field-label">
              <span>{t("notes")}</span>
              <textarea name="notes" defaultValue={data.notes ?? ""} rows={4} />
            </label>

            <div className="review-actions">
              <SubmitButton className="form-primary" idleLabel={t("saveImport")} pendingLabel={t("saving")} />
              <button formAction={cancelImportReview} className="form-secondary" type="submit">{t("cancel")}</button>
              <Link className="form-secondary" href="/import">{t("back")}</Link>
            </div>
          </form>
        </section>
      </div>
    );
  });
}
