import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { getSettingsCached } from "@/lib/cached-data";
import { clearCsvImportReviewDraft, csvPreviewColumns, getCsvImportReviewDraft, saveCsvImportReview } from "@/lib/import-review";
import { getTranslations } from "@/lib/i18n";
import { withRequestContext, withTiming } from "@/lib/observability";
import { requireCompanyId } from "@/lib/session";

export const runtime = "nodejs";

async function saveCsvReview() {
  "use server";
  const companyId = await requireCompanyId();
  const draft = await getCsvImportReviewDraft();
  if (!draft) redirect("/import?status=csv_review_expired");

  const settings = await getSettingsCached(companyId);
  const result = await saveCsvImportReview({
    companyId,
    draft,
    defaultCurrency: settings?.displayCurrency ?? "USD",
    defaultAlertDays: settings?.defaultAlertDays ?? 30,
  });

  await clearCsvImportReviewDraft();
  revalidatePath("/dashboard");
  revalidatePath("/action-required");
  revalidatePath(result.redirectTo);
  redirect(`${result.redirectTo}?status=csv_imported&count=${result.imported}`);
}

async function cancelCsvReview() {
  "use server";
  await clearCsvImportReviewDraft();
  redirect("/import");
}

export default async function Page() {
  const companyId = await requireCompanyId();
  return withRequestContext({ route: "/import/csv-review", companyId }, async () => {
    const draft = await getCsvImportReviewDraft();
    if (!draft) redirect("/import?status=csv_review_expired");

    const settings = await withTiming("csv-import-review.settings", () => getSettingsCached(companyId));
    const { t } = getTranslations(settings?.language);
    const columns = csvPreviewColumns(draft.type);

    return (
      <div className="page">
        <div className="page-header">
          <p className="eyebrow">{t("automation")}</p>
          <h1 className="page-title">{t("reviewCsvImport")}</h1>
          <p className="page-hero">{t("reviewCsvImportHero")}</p>
          <p className="muted">{t("reviewCsvImportSubtitle")}</p>
        </div>

        <section className="panel import-panel">
          <div className="panel-title">{t("csvImportPreview")}</div>
          <div className="csv-review-meta">
            <span>{t("sourceFile")}: {draft.sourceName}</span>
            <span>{t("importType")}: {t(draft.type === "ledger" ? "accounting" : draft.type)}</span>
            <span>{draft.rows.length} {t("csvRowsFound")}</span>
          </div>

          <div className="csv-preview-table-wrap">
            <table className="table csv-preview-table">
              <thead>
                <tr>
                  {columns.map((column) => <th key={column}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => <td key={column}>{row[column] || row[column.replaceAll("_", "")] || "-"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={saveCsvReview} className="review-actions csv-review-actions">
            <SubmitButton className="form-primary" idleLabel={t("saveCsvImport")} pendingLabel={t("saving")} />
            <button formAction={cancelCsvReview} className="form-secondary" type="submit">{t("cancel")}</button>
            <Link className="form-secondary" href="/import">{t("back")}</Link>
          </form>
        </section>
      </div>
    );
  });
}
