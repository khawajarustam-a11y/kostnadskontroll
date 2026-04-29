import { Currency, LedgerEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSettingsCached } from "@/lib/cached-data";
import { getComputedStatus } from "@/lib/contract-risk";
import { convertWithUsdRates, getUsdRates } from "@/lib/currency";
import { getTranslations } from "@/lib/i18n";
import { withRequestContext, withTiming } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { clampAlertDays, parseCurrency, parseOptionalDate, parsePositiveAmount } from "@/lib/validation";

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

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key.toLowerCase()];
    if (value) return value;
  }
  return "";
}

async function importCsv(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const importType = String(formData.get("importType") ?? "") as ImportType;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/import?status=missing_file");
  }

  const rows = parseCsv(await file.text());
  if (rows.length === 0) {
    redirect("/import?status=empty_file");
  }

  const settings = await getSettingsCached(companyId);
  const defaultCurrency: Currency = settings?.displayCurrency ?? "USD";
  const defaultAlertDays = settings?.defaultAlertDays ?? 30;
  const usdRates = await getUsdRates();
  const now = new Date();
  let imported = 0;

  if (importType === "contracts") {
    for (const row of rows) {
      const name = pick(row, ["name", "contract", "title"]);
      if (!name) continue;
      const supplier = pick(row, ["supplier", "vendor", "company"]);
      const startDate = parseOptionalDate(pick(row, ["startdate", "start_date", "start"]));
      const endDate = parseOptionalDate(pick(row, ["enddate", "end_date", "end"]));
      const renewalDate = parseOptionalDate(pick(row, ["renewaldate", "renewal_date", "renewal"]));
      const cancelByDate = parseOptionalDate(pick(row, ["cancelbydate", "cancel_by_date", "cancelby", "cancel_by"]));
      if (startDate === "invalid" || endDate === "invalid" || renewalDate === "invalid" || cancelByDate === "invalid") continue;
      const pricePerMonth = parsePositiveAmount(pick(row, ["pricepermonth", "price_per_month", "monthlyprice", "monthly_price", "amount"]));
      const currency = parseCurrency(pick(row, ["currency"])) ?? defaultCurrency;
      const alertDays = clampAlertDays(pick(row, ["alertdays", "alert_days"]), defaultAlertDays);
      const notes = pick(row, ["notes", "note"]);
      const computedStatus = getComputedStatus(endDate, cancelByDate, now);

      await prisma.contract.create({
        data: {
          companyId,
          name,
          supplier: supplier || null,
          startDate,
          endDate,
          renewalDate,
          cancelByDate,
          status: computedStatus,
          pricePerMonth,
          currency,
          alertDays,
          notes: notes || null,
        },
      });
      imported += 1;
    }
    revalidatePath("/contracts");
    revalidatePath("/dashboard");
    revalidatePath("/action-required");
  }

  if (importType === "costs") {
    for (const row of rows) {
      const name = pick(row, ["name", "cost", "title"]);
      const amount = parsePositiveAmount(pick(row, ["amount", "price", "cost"]));
      const currency = parseCurrency(pick(row, ["currency"])) ?? defaultCurrency;
      if (!name || amount === null) continue;
      const supplier = pick(row, ["supplier", "vendor", "company"]);
      const category = pick(row, ["category"]);
      const frequency = (pick(row, ["frequency", "period"]) || "MONTHLY").toUpperCase();
      const startDate = parseOptionalDate(pick(row, ["startdate", "start_date", "start"]));
      if (startDate === "invalid") continue;
      const amountUsd = convertWithUsdRates(amount, currency, "USD", usdRates);
      await prisma.cost.create({
        data: {
          companyId,
          name,
          supplier: supplier || null,
          category: category || null,
          amount,
          currency,
          amountUsd,
          frequency,
          startDate,
        },
      });
      imported += 1;
    }
    revalidatePath("/costs");
    revalidatePath("/dashboard");
  }

  if (importType === "ledger") {
    for (const row of rows) {
      const amount = parsePositiveAmount(pick(row, ["amount", "price"]));
      const currency = parseCurrency(pick(row, ["currency"])) ?? defaultCurrency;
      const date = parseOptionalDate(pick(row, ["date", "entrydate", "entry_date"]));
      if (amount === null || date === null || date === "invalid") continue;
      const rawType = pick(row, ["type"]).toUpperCase();
      const type: LedgerEntryType = rawType === "INCOME" ? "INCOME" : "EXPENSE";
      const category = pick(row, ["category"]);
      const description = pick(row, ["description", "notes", "note"]);
      await prisma.ledgerEntry.create({
        data: {
          companyId,
          type,
          amount,
          currency,
          category: category || null,
          description: description || null,
          entryDate: date,
        },
      });
      imported += 1;
    }
    revalidatePath("/ledger");
    revalidatePath("/dashboard");
  }

  redirect("/import?status=imported&count=" + imported);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; count?: string }>;
}) {
  const companyId = await requireCompanyId();
  return withRequestContext({ route: "/import", companyId }, async () => {
    const settings = await withTiming("import.settings", () => getSettingsCached(companyId));
    const { t } = getTranslations(settings?.language);
    const { status, count } = searchParams ? await searchParams : {};

    return (
      <div className="page">
        <div className="page-header">
          <p className="eyebrow">{t("automation")}</p>
          <h1 className="page-title">{t("importData")}</h1>
          <p className="page-hero">{t("importHero")}</p>
          <p className="muted">{t("importSubtitle")}</p>
        </div>

        {status === "imported" ? (
          <div className="alert-panel alert-panel-safe">
            <div className="alert-panel-header">
              <span className="badge badge-safe">{t("notice")}</span>
              <h2>{count ?? 0} {t("rowsImported")}</h2>
            </div>
          </div>
        ) : null}
        {status === "missing_file" || status === "empty_file" ? (
          <p className="form-error">{t("importError")}</p>
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
                <input name="file" type="file" accept=".csv,text/csv" required />
              </label>
            </div>
            <button type="submit" className="form-primary">{t("importCsv")}</button>
          </form>
        </section>

        <section className="panel import-panel muted-panel">
          <div className="panel-title">{t("photoEmailImport")}</div>
          <p className="muted">{t("photoEmailImportText")}</p>
          <div className="import-disabled-grid">
            <button type="button" className="form-secondary" disabled>{t("uploadPhoto")}</button>
            <button type="button" className="form-secondary" disabled>{t("connectEmail")}</button>
          </div>
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
