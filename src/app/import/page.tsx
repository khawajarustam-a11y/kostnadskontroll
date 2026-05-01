import { redirect } from "next/navigation";
import { FilePicker } from "@/components/FilePicker";
import { SubmitButton } from "@/components/SubmitButton";
import { getSettingsCached } from "@/lib/cached-data";
import { DocumentImportError, DocumentImportType, extractFromDocument } from "@/lib/document-import";
import { setCsvImportReviewDraft, setImportReviewDraft } from "@/lib/import-review";
import { getTranslations, TranslationKey } from "@/lib/i18n";
import { withRequestContext, withTiming } from "@/lib/observability";
import { requireCompanyId } from "@/lib/session";

export const runtime = "nodejs";

type ImportType = "contracts" | "costs" | "ledger";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(current.trim());
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? "";
    });
    return record;
  });
}


async function importCsv(formData: FormData) {
  "use server";
  await requireCompanyId();
  const importType = String(formData.get("importType") ?? "contracts") as ImportType;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/import?status=missing_file");
  }

  const rows = parseCsv(await file.text());
  if (rows.length === 0) {
    redirect("/import?status=empty_file");
  }
  if (rows.length > 20) {
    redirect("/import?status=csv_too_large");
  }

  await setCsvImportReviewDraft({
    type: importType,
    sourceName: file.name || "CSV file",
    rows,
  });
  redirect("/import/csv-review");
}

async function importDocument(formData: FormData) {
  "use server";
  await requireCompanyId();
  const importType = String(formData.get("documentImportType") ?? "contracts") as DocumentImportType;
  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/import?status=missing_file");
  }
  if (!process.env.OPENAI_API_KEY) {
    redirect("/import?status=missing_ai");
  }

  let extracted;
  try {
    extracted = await extractFromDocument(file, importType);
  } catch (error) {
    const code = error instanceof DocumentImportError ? error.code : "unknown";
    redirect(`/import?status=ai_error&code=${code}`);
  }
  if (!extracted) {
    redirect("/import?status=no_extraction");
  }

  await setImportReviewDraft({
    type: importType,
    sourceName: file.name || "document",
    data: {
      ...extracted,
      amount: extracted.amount ?? extracted.pricePerMonth,
      notes: extracted.notes ? `Imported from ${file.name}. ${extracted.notes}` : `Imported from ${file.name}. Please verify the extracted details.`,
    },
  });
  redirect("/import/review");
}

async function importEmailText(formData: FormData) {
  "use server";
  await requireCompanyId();
  const importType = String(formData.get("emailImportType") ?? "contracts") as DocumentImportType;
  const emailText = String(formData.get("emailText") ?? "").trim();
  if (emailText.length < 20) {
    redirect("/import?status=missing_email_text");
  }
  if (!process.env.OPENAI_API_KEY) {
    redirect("/import?status=missing_ai");
  }

  const file = new File([emailText], "pasted-email.txt", { type: "text/plain" });
  let extracted;
  try {
    extracted = await extractFromDocument(file, importType);
  } catch (error) {
    const code = error instanceof DocumentImportError ? error.code : "unknown";
    redirect(`/import?status=ai_error&code=${code}`);
  }
  if (!extracted) {
    redirect("/import?status=no_extraction");
  }

  await setImportReviewDraft({
    type: importType,
    sourceName: "Pasted email",
    data: {
      ...extracted,
      amount: extracted.amount ?? extracted.pricePerMonth,
      notes: extracted.notes ? `Imported from pasted email. ${extracted.notes}` : "Imported from pasted email. Please verify the extracted details.",
    },
  });
  redirect("/import/review");
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; count?: string; code?: string }>;
}) {
  const companyId = await requireCompanyId();
  return withRequestContext({ route: "/import", companyId }, async () => {
    const settings = await withTiming("import.settings", () => getSettingsCached(companyId));
    const { t } = getTranslations(settings?.language);
    const { status, count, code } = searchParams ? await searchParams : {};
    const openAiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
    const detectedOpenAiKeys = Object.keys(process.env)
      .filter((key) => key.toUpperCase().includes("OPENAI") || key.toUpperCase().includes("OPEN_AI"))
      .sort();
    const vercelEnv = process.env.VERCEL_ENV ?? "unknown";
    const aiStatus = openAiKey
      ? openAiKey.startsWith("sk-")
        ? t("aiKeyLooksValid")
        : t("aiKeyWrongFormat")
      : t("aiKeyMissing");
    const aiErrorKeys: Record<string, TranslationKey> = {
      invalid_key: "aiError_invalid_key",
      forbidden: "aiError_forbidden",
      rate_limited: "aiError_rate_limited",
      openai_down: "aiError_openai_down",
      request_failed: "aiError_request_failed",
      bad_response: "aiError_bad_response",
      unknown: "aiError_unknown",
    };
    const aiErrorKey = aiErrorKeys[code ?? "unknown"] ?? "aiError_unknown";

    return (
      <div className="page">
        <div className="page-header">
          <p className="eyebrow">{t("automation")}</p>
          <h1 className="page-title">{t("importData")}</h1>
          <p className="page-hero">{t("importHero")}</p>
          <p className="muted">{t("importSubtitle")}</p>
        </div>

        {status === "imported" || status === "document_imported" ? (
          <div className="alert-panel alert-panel-safe">
            <div className="alert-panel-header">
              <span className="badge badge-safe">{t("notice")}</span>
              <h2>{count ?? 0} {status === "document_imported" ? t("documentsImported") : t("rowsImported")}</h2>
            </div>
          </div>
        ) : null}
        {status === "missing_file" || status === "empty_file" ? (
          <p className="form-error">{t("importError")}</p>
        ) : null}
        {status === "missing_email_text" ? (
          <p className="form-error">{t("emailTextImportError")}</p>
        ) : null}
        {status === "csv_too_large" ? (
          <p className="form-error">{t("csvTooLarge")}</p>
        ) : null}
        {status === "missing_ai" ? (
          <div className="form-error import-config-error">
            <p>{t("missingAiKey")}</p>
            <p>{t("aiKeyStatus")}: {aiStatus}</p>
            <p>{t("vercelEnvironment")}: {vercelEnv}</p>
            <p>{t("detectedOpenAiVariables")}: {detectedOpenAiKeys.length > 0 ? detectedOpenAiKeys.join(", ") : t("none")}</p>
          </div>
        ) : null}
        {status === "no_extraction" ? (
          <p className="form-error">{t("noExtraction")}</p>
        ) : null}
        {status === "ai_error" ? (
          <p className="form-error">{t("aiExtractionError")}: {t(aiErrorKey)}</p>
        ) : null}
        {status === "review_expired" ? (
          <p className="form-error">{t("reviewImportExpired")}</p>
        ) : null}
        {status === "csv_review_expired" ? (
          <p className="form-error">{t("csvReviewExpired")}</p>
        ) : null}

        <section className="panel import-panel">
          <div className="panel-title">{t("csvImport")}</div>
          <form action={importCsv} className="stack">
            <div className="form-grid form-grid-3">
              <label className="field-label">
                <span>{t("importType")}</span>
                <select name="importType" defaultValue="contracts">
                  <option value="contracts">{t("contracts")}</option>
                  <option value="costs">{t("costs")}</option>
                  <option value="ledger">{t("accounting")}</option>
                </select>
              </label>
              <label className="field-label field-label-wide">
                <span>{t("csvFile")}</span>
                <FilePicker name="file" accept=".csv,text/csv" required chooseLabel={t("chooseFile")} noFileLabel={t("noFileSelected")} />
              </label>
            </div>
            <SubmitButton className="form-primary" idleLabel={t("previewCsv")} pendingLabel={t("importing")} />
          </form>
        </section>

        <section className="panel import-panel">
          <div className="panel-title">{t("photoEmailImport")}</div>
          <p className="muted">{t("photoEmailImportText")}</p>
          <form action={importDocument} className="stack">
            <div className="form-grid form-grid-3">
              <label className="field-label">
                <span>{t("importType")}</span>
                <select name="documentImportType" defaultValue="contracts">
                  <option value="contracts">{t("contracts")}</option>
                  <option value="costs">{t("costs")}</option>
                  <option value="ledger">{t("accounting")}</option>
                </select>
              </label>
              <label className="field-label field-label-wide">
                <span>{t("documentFile")}</span>
                <FilePicker name="document" accept="image/*,.pdf,.txt,.eml,text/plain,message/rfc822,application/pdf" required chooseLabel={t("chooseFile")} noFileLabel={t("noFileSelected")} />
              </label>
            </div>
            <div className="import-actions-row">
              <SubmitButton className="form-primary" idleLabel={t("extractDetails")} pendingLabel={t("extracting")} />
              <span className="muted">{t("documentImportNote")}</span>
            </div>
          </form>

          <div className="import-divider" />

          <form action={importEmailText} className="stack">
            <div className="panel-title compact-title">{t("pasteEmailText")}</div>
            <div className="form-grid form-grid-3">
              <label className="field-label">
                <span>{t("importType")}</span>
                <select name="emailImportType" defaultValue="contracts">
                  <option value="contracts">{t("contracts")}</option>
                  <option value="costs">{t("costs")}</option>
                  <option value="ledger">{t("accounting")}</option>
                </select>
              </label>
              <label className="field-label field-label-wide import-email-text-field">
                <span>{t("emailText")}</span>
                <textarea name="emailText" rows={7} placeholder={t("emailTextPlaceholder")} required />
              </label>
            </div>
            <div className="import-actions-row">
              <SubmitButton className="form-primary" idleLabel={t("scanEmailText")} pendingLabel={t("extracting")} />
              <span className="muted">{t("emailTextImportNote")}</span>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-title">{t("csvFormat")}</div>
          <div className="csv-help-grid">
            <div>
              <strong>{t("contracts")}</strong>
              <p className="muted">name,supplier,price_per_month,currency,start_date,end_date,renewal_date,cancel_by_date,alert_days,notes</p>
            </div>
            <div>
              <strong>{t("costs")}</strong>
              <p className="muted">name,supplier,category,amount,currency,frequency,start_date</p>
            </div>
            <div>
              <strong>{t("accounting")}</strong>
              <p className="muted">date,type,amount,currency,category,description</p>
            </div>
          </div>
        </section>
      </div>
    );
  });
}
