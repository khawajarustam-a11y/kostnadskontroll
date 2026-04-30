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
