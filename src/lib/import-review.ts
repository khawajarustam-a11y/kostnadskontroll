import { cookies } from "next/headers";
import { Currency, LedgerEntryType } from "@prisma/client";
import { getComputedStatus } from "@/lib/contract-risk";
import { DocumentImportType, ExtractedDocumentImport } from "@/lib/document-import";
import { convertWithUsdRates, getUsdRates } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { parseOptionalDate } from "@/lib/validation";

const COOKIE_NAME = "import_review_draft";

type ImportReviewDraft = {
  type: DocumentImportType;
  sourceName: string;
  data: ExtractedDocumentImport;
};

export async function setImportReviewDraft(draft: ImportReviewDraft) {
  const store = await cookies();
  store.set(COOKIE_NAME, Buffer.from(JSON.stringify(draft), "utf8").toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/import",
    maxAge: 60 * 20,
  });
}

export async function getImportReviewDraft() {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as ImportReviewDraft;
  } catch {
    return null;
  }
}

export async function clearImportReviewDraft() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export function dateInputValue(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function nullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseAmount(value: FormDataEntryValue | null) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function parseCurrencyValue(value: FormDataEntryValue | null, fallback: Currency): Currency {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "USD" || raw === "NOK" || raw === "EUR") return raw;
  return fallback;
}

function parseLedgerType(value: FormDataEntryValue | null): LedgerEntryType {
  return String(value ?? "").toUpperCase() === "INCOME" ? "INCOME" : "EXPENSE";
}


const CSV_COOKIE_NAME = "csv_import_review_draft";

export type CsvImportReviewDraft = {
  type: DocumentImportType;
  sourceName: string;
  rows: Record<string, string>[];
};

export async function setCsvImportReviewDraft(draft: CsvImportReviewDraft) {
  const store = await cookies();
  store.set(CSV_COOKIE_NAME, Buffer.from(JSON.stringify(draft), "utf8").toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/import",
    maxAge: 60 * 20,
  });
}

export async function getCsvImportReviewDraft() {
  const store = await cookies();
  const value = store.get(CSV_COOKIE_NAME)?.value;
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CsvImportReviewDraft;
  } catch {
    return null;
  }
}

export async function clearCsvImportReviewDraft() {
  const store = await cookies();
  store.delete(CSV_COOKIE_NAME);
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key.toLowerCase()];
    if (value) return value;
  }
  return "";
}

function clampAlertDays(value: string, fallback = 30): number {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(365, Math.floor(parsed)));
}

export function csvPreviewColumns(type: DocumentImportType) {
  if (type === "contracts") return ["name", "supplier", "price_per_month", "currency", "start_date", "end_date", "renewal_date", "cancel_by_date"];
  if (type === "costs") return ["name", "supplier", "category", "amount", "currency", "frequency", "start_date"];
  return ["date", "type", "amount", "currency", "category", "description"];
}

export async function saveCsvImportReview({
  companyId,
  draft,
  defaultCurrency,
  defaultAlertDays,
}: {
  companyId: string;
  draft: CsvImportReviewDraft;
  defaultCurrency: Currency;
  defaultAlertDays: number;
}) {
  const usdRates = await getUsdRates();
  const now = new Date();
  let imported = 0;

  if (draft.type === "contracts") {
    for (const row of draft.rows) {
      const name = pick(row, ["name", "contract", "title"]);
      if (!name) continue;
      const supplier = pick(row, ["supplier", "vendor", "company"]);
      const startDate = parseOptionalDate(pick(row, ["startdate", "start_date", "start"]));
      const endDate = parseOptionalDate(pick(row, ["enddate", "end_date", "end"]));
      const renewalDate = parseOptionalDate(pick(row, ["renewaldate", "renewal_date", "renewal"]));
      const cancelByDate = parseOptionalDate(pick(row, ["cancelbydate", "cancel_by_date", "cancelby", "cancel_by"]));
      if (startDate === "invalid" || endDate === "invalid" || renewalDate === "invalid" || cancelByDate === "invalid") continue;
      const amount = parseAmount(pick(row, ["pricepermonth", "price_per_month", "monthlyprice", "monthly_price", "amount"]));
      const currency = parseCurrencyValue(pick(row, ["currency"]), defaultCurrency);
      await prisma.contract.create({
        data: {
          companyId,
          name,
          supplier: supplier || null,
          startDate,
          endDate,
          renewalDate,
          cancelByDate,
          status: getComputedStatus(endDate, cancelByDate, now),
          pricePerMonth: amount,
          currency,
          alertDays: clampAlertDays(pick(row, ["alertdays", "alert_days"]), defaultAlertDays),
          notes: pick(row, ["notes", "note"]) || null,
        },
      });
      imported += 1;
    }
    return { imported, redirectTo: "/contracts" };
  }

  if (draft.type === "costs") {
    for (const row of draft.rows) {
      const name = pick(row, ["name", "cost", "title"]);
      const amount = parseAmount(pick(row, ["amount", "price", "cost"]));
      const currency = parseCurrencyValue(pick(row, ["currency"]), defaultCurrency);
      if (!name || amount === null) continue;
      const startDate = parseOptionalDate(pick(row, ["startdate", "start_date", "start"]));
      if (startDate === "invalid") continue;
      await prisma.cost.create({
        data: {
          companyId,
          name,
          supplier: pick(row, ["supplier", "vendor", "company"]) || null,
          category: pick(row, ["category"]) || null,
          amount,
          currency,
          amountUsd: convertWithUsdRates(amount, currency, "USD", usdRates),
          frequency: (pick(row, ["frequency", "period"]) || "MONTHLY").toUpperCase(),
          startDate,
        },
      });
      imported += 1;
    }
    return { imported, redirectTo: "/costs" };
  }

  for (const row of draft.rows) {
    const amount = parseAmount(pick(row, ["amount", "price"]));
    const currency = parseCurrencyValue(pick(row, ["currency"]), defaultCurrency);
    const entryDate = parseOptionalDate(pick(row, ["date", "entrydate", "entry_date"]));
    if (amount === null || entryDate === null || entryDate === "invalid") continue;
    await prisma.ledgerEntry.create({
      data: {
        companyId,
        type: parseLedgerType(pick(row, ["type"])),
        amount,
        currency,
        category: pick(row, ["category"]) || null,
        description: pick(row, ["description", "notes", "note"]) || null,
        entryDate,
      },
    });
    imported += 1;
  }
  return { imported, redirectTo: "/ledger" };
}

export async function saveReviewedImport({
  companyId,
  type,
  formData,
  defaultCurrency,
  defaultAlertDays,
}: {
  companyId: string;
  type: DocumentImportType;
  formData: FormData;
  defaultCurrency: Currency;
  defaultAlertDays: number;
}) {
  const name = nullable(formData.get("name"));
  const supplier = nullable(formData.get("supplier"));
  const category = nullable(formData.get("category"));
  const notes = nullable(formData.get("notes"));
  const amount = parseAmount(formData.get("amount"));
  const currency = parseCurrencyValue(formData.get("currency"), defaultCurrency);

  if (type === "contracts") {
    if (!name) return { ok: false as const };
    const startDate = parseOptionalDate(formData.get("startDate"));
    const endDate = parseOptionalDate(formData.get("endDate"));
    const renewalDate = parseOptionalDate(formData.get("renewalDate"));
    const cancelByDate = parseOptionalDate(formData.get("cancelByDate"));
    if (startDate === "invalid" || endDate === "invalid" || renewalDate === "invalid" || cancelByDate === "invalid") return { ok: false as const };
    const alertDaysValue = Number(formData.get("alertDays") ?? defaultAlertDays);
    const alertDays = Number.isFinite(alertDaysValue) ? Math.max(1, Math.min(365, Math.floor(alertDaysValue))) : defaultAlertDays;

    await prisma.contract.create({
      data: {
        companyId,
        name,
        supplier,
        pricePerMonth: amount,
        currency,
        startDate,
        endDate,
        renewalDate,
        cancelByDate,
        status: getComputedStatus(endDate, cancelByDate, new Date()),
        alertDays,
        notes,
      },
    });
    return { ok: true as const, redirectTo: "/contracts" };
  }

  if (type === "costs") {
    if (!name || amount === null) return { ok: false as const };
    const startDate = parseOptionalDate(formData.get("startDate"));
    if (startDate === "invalid") return { ok: false as const };
    const amountUsd = convertWithUsdRates(amount, currency, "USD", await getUsdRates());

    await prisma.cost.create({
      data: {
        companyId,
        name,
        supplier,
        category,
        amount,
        currency,
        amountUsd,
        frequency: String(formData.get("frequency") || "MONTHLY").toUpperCase(),
        startDate,
        notes,
      },
    });
    return { ok: true as const, redirectTo: "/costs" };
  }

  if (amount === null) return { ok: false as const };
  const entryDate = parseOptionalDate(formData.get("entryDate"));
  if (entryDate === null || entryDate === "invalid") return { ok: false as const };
  await prisma.ledgerEntry.create({
    data: {
      companyId,
      type: parseLedgerType(formData.get("entryType")),
      amount,
      currency,
      category,
      description: nullable(formData.get("description")),
      entryDate,
    },
  });
  return { ok: true as const, redirectTo: "/ledger" };
}
