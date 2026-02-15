import { Currency } from "@prisma/client";

export function parsePositiveAmount(value: FormDataEntryValue | null): number | null {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount > 10_000_000_000) return null;
  return amount;
}

export function parseOptionalDate(value: FormDataEntryValue | null): Date | null | "invalid" {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
}

export function parseCurrency(value: FormDataEntryValue | null): Currency | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "USD" || raw === "NOK" || raw === "EUR") return raw;
  return null;
}

export function clampAlertDays(value: FormDataEntryValue | null, fallback = 30): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(365, Math.floor(parsed)));
}

