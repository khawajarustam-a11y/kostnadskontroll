import { Currency } from "@prisma/client";
import { cache } from "react";

export type UsdRates = Record<Currency, number>;

const FALLBACK_USD_TO: UsdRates = {
  USD: 1,
  NOK: 10.5,
  EUR: 0.92,
};

const getUsdRatesCached = cache(async (): Promise<UsdRates> => {
  try {
    const url = new URL("https://api.exchangerate.host/latest");
    url.searchParams.set("base", "USD");
    url.searchParams.set("symbols", "USD,NOK,EUR");

    const response = await fetch(url.toString(), {
      next: { revalidate: 3600 },
    });
    if (!response.ok) {
      return FALLBACK_USD_TO;
    }

    const data = (await response.json()) as {
      rates?: Partial<Record<Currency, number>>;
    };
    const rates = data.rates ?? {};
    if (!rates.USD || !rates.NOK || !rates.EUR) {
      return FALLBACK_USD_TO;
    }

    return {
      USD: rates.USD,
      NOK: rates.NOK,
      EUR: rates.EUR,
    };
  } catch {
    return FALLBACK_USD_TO;
  }
});

export async function getUsdRates(): Promise<UsdRates> {
  return getUsdRatesCached();
}

export function convertWithUsdRates(
  amount: number,
  from: Currency,
  to: Currency,
  usdTo: UsdRates
): number {
  if (from === to) {
    return amount;
  }

  const usdAmount = from === "USD" ? amount : amount / usdTo[from];
  return to === "USD" ? usdAmount : usdAmount * usdTo[to];
}

export function formatCurrency(
  amount: number,
  currency: Currency,
  locale: string
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
