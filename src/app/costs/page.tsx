import { prisma } from "@/lib/prisma";
import {
  convertWithUsdRates,
  formatCurrency,
  getUsdRates,
} from "@/lib/currency";
import { getTranslations } from "@/lib/i18n";
import { requireCompanyId } from "@/lib/session";
import { Currency } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import ConfirmDeleteForm from "@/components/ConfirmDeleteForm";
import CostsControls from "@/components/CostsControls";
import { withRequestContext, withTiming } from "@/lib/observability";
import { parseCurrency, parsePositiveAmount } from "@/lib/validation";
import { getSettingsCached } from "@/lib/cached-data";

export const runtime = "nodejs";

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getNextChargeDate(cost: { frequency: string; startDate: Date | null; createdAt: Date }, now: Date) {
  const base = cost.startDate ?? cost.createdAt;
  if (!base) return null;
  let next = new Date(base);
  const freq = cost.frequency.toUpperCase();
  if (freq === "WEEKLY") {
    while (next <= now) {
      next = addDays(next, 7);
    }
    return next;
  }
  if (freq === "YEARLY" || freq === "ANNUAL") {
    while (next <= now) {
      next = new Date(next.getFullYear() + 1, next.getMonth(), next.getDate());
    }
    return next;
  }
  while (next <= now) {
    next = new Date(next.getFullYear(), next.getMonth() + 1, next.getDate());
  }
  return next;
}

function daysUntil(date: Date, now: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / msPerDay));
}

async function createCost(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const name = String(formData.get("name") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const amountValue = parsePositiveAmount(formData.get("amount"));
  const currency = parseCurrency(formData.get("currency"));
  const frequency = String(formData.get("frequency") ?? "MONTHLY").toUpperCase();

  if (!name || amountValue === null || !currency) {
    redirect("/costs?error=invalid_cost");
  }

  const usdRates = await getUsdRates();
  const amountUsd = convertWithUsdRates(
    amountValue,
    currency,
    "USD",
    usdRates
  );

  await prisma.cost.create({
    data: {
      companyId,
      name,
      supplier: supplier || null,
      category: category || null,
      amount: amountValue,
      currency,
      amountUsd,
      frequency,
    },
  });

  revalidatePath("/costs");
  revalidatePath("/dashboard");
}

async function deleteCost(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }
  await prisma.cost.updateMany({
    where: { id, companyId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/costs");
  revalidatePath("/dashboard");
}

async function restoreCost(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }
  await prisma.cost.updateMany({
    where: { id, companyId },
    data: { deletedAt: null },
  });
  revalidatePath("/costs");
  revalidatePath("/dashboard");
}

async function deleteCostForever(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }
  await prisma.cost.deleteMany({
    where: { id, companyId },
  });
  revalidatePath("/costs");
  revalidatePath("/dashboard");
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    view?: string;
    filter?: string;
    sort?: string;
  }>;
}) {
  const companyId = await requireCompanyId();
  return withRequestContext({ route: "/costs", companyId }, async () => {
  const settings = await withTiming("costs.settings", () =>
    getSettingsCached(companyId)
  );
  const { t, language } = getTranslations(settings?.language);
  const baseCurrency: Currency = settings?.baseCurrency ?? "USD";
  const displayCurrency: Currency = settings?.displayCurrency ?? "USD";
  const locale = language === "NO" ? "nb-NO" : "en-US";
  const { error, view, filter, sort } = searchParams ? await searchParams : {};
  const errorMessage = error === "invalid_cost" ? t("errorInvalidCost") : null;
  const addCostLabel =
    t("addCost") || (language === "NO" ? "Legg til kostnad" : "Add cost");
  const confirmDelete = t("confirmDelete");
  const confirmDeleteForever = t("confirmDeleteForever");

  const usdRates = await getUsdRates();

  const [costs, deletedCosts] = await withTiming("costs.list_data", () =>
    Promise.all([
      prisma.cost.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          supplier: true,
          category: true,
          amount: true,
          currency: true,
          frequency: true,
          createdAt: true,
          startDate: true,
        },
      }),
      prisma.cost.findMany({
        where: { companyId, deletedAt: { not: null } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          supplier: true,
          category: true,
          amount: true,
          currency: true,
          frequency: true,
          createdAt: true,
        },
      }),
    ])
  );
  const showDeleted = view === "deleted";
  const selectedFilter = filter ?? "ALL";
  const selectedSort = sort ?? "next_payment";

  const monthlyCostsCount = costs.filter((cost) => cost.frequency === "MONTHLY").length;
  const yearlyCostsCount = costs.filter((cost) => cost.frequency === "YEARLY").length;
  const weeklyCostsCount = costs.filter((cost) => cost.frequency === "WEEKLY").length;
  const now = new Date();
  const riskUntil = addDays(now, settings?.defaultAlertDays ?? 30);

  const enrichedCosts = costs.map((cost) => {
    const amount = Number(cost.amount);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const amountInBase = convertWithUsdRates(
      safeAmount,
      cost.currency,
      baseCurrency,
      usdRates
    );
    const amountInDisplay = convertWithUsdRates(
      amountInBase,
      baseCurrency,
      displayCurrency,
      usdRates
    );
    const nextChargeDate = getNextChargeDate(cost, now);
    return {
      cost,
      amount,
      amountInBase,
      amountInDisplay,
      nextChargeDate,
    };
  });

  const visibleCosts = enrichedCosts.filter(({ cost }) =>
    selectedFilter === "ALL" ? true : cost.frequency === selectedFilter
  );

  const sortedCosts = [...visibleCosts].sort((a, b) => {
    if (selectedSort === "amount_desc") {
      return b.amountInDisplay - a.amountInDisplay;
    }
    if (selectedSort === "amount_asc") {
      return a.amountInDisplay - b.amountInDisplay;
    }
    if (selectedSort === "vendor") {
      return (a.cost.supplier ?? "").localeCompare(b.cost.supplier ?? "");
    }
    const aTime = a.nextChargeDate ? a.nextChargeDate.getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.nextChargeDate ? b.nextChargeDate.getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  const monthlyTotal = costs.reduce((sum, cost) => {
    const amount = Number(cost.amount);
    if (!Number.isFinite(amount)) return sum;
    const amountInBase = convertWithUsdRates(amount, cost.currency, baseCurrency, usdRates);
    const amountInDisplay = convertWithUsdRates(amountInBase, baseCurrency, displayCurrency, usdRates);
    if (cost.frequency === "YEARLY") return sum + amountInDisplay / 12;
    if (cost.frequency === "WEEKLY") return sum + amountInDisplay * (52 / 12);
    return sum + amountInDisplay;
  }, 0);

  const yearlyTotal = costs.reduce((sum, cost) => {
    const amount = Number(cost.amount);
    if (!Number.isFinite(amount)) return sum;
    const amountInBase = convertWithUsdRates(amount, cost.currency, baseCurrency, usdRates);
    const amountInDisplay = convertWithUsdRates(amountInBase, baseCurrency, displayCurrency, usdRates);
    if (cost.frequency === "MONTHLY") return sum + amountInDisplay * 12;
    if (cost.frequency === "WEEKLY") return sum + amountInDisplay * 52;
    return sum + amountInDisplay;
  }, 0);

  const nextCharges = enrichedCosts
    .filter((item) => item.nextChargeDate !== null)
    .map((item) => ({ cost: item.cost, nextChargeDate: item.nextChargeDate as Date }));

  const nextCharge = nextCharges.sort(
    (a, b) => (a.nextChargeDate as Date).getTime() - (b.nextChargeDate as Date).getTime()
  )[0];
  const nextChargeDays = nextCharge?.nextChargeDate
    ? daysUntil(nextCharge.nextChargeDate, now)
    : null;

  const riskTotal = nextCharges.reduce((sum, item) => {
    const nextDate = item.nextChargeDate as Date;
    if (nextDate > riskUntil) return sum;
    const amount = Number(item.cost.amount);
    const amountInBase = convertWithUsdRates(amount, item.cost.currency, baseCurrency, usdRates);
    const amountInDisplay = convertWithUsdRates(amountInBase, baseCurrency, displayCurrency, usdRates);
    return sum + amountInDisplay;
  }, 0);

  return (
    <div className="page costs-page">
      <div className="page-header">
        <h1 className="page-title">{t("costs")}</h1>
        <p className="muted">{t("costsSubtitle")}</p>
      </div>
      <div className="kpi-row kpi-row-compact">
        <div className={`kpi ${riskTotal > 0 ? "kpi-warning-card" : ""}`}>
          <div className="kpi-label">{t("costCount")}</div>
          <div className="kpi-value">{costs.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("costsSummaryMonthlyTotal")}</div>
          <div className="kpi-value">{formatCurrency(monthlyTotal, displayCurrency, locale)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("costsSummaryYearlyTotal")}</div>
          <div className="kpi-value">{formatCurrency(yearlyTotal, displayCurrency, locale)}</div>
        </div>
      </div>
      <div className="kpi-row kpi-row-compact">
        <div className="kpi">
          <div className="kpi-label">{t("costsSummaryNextCharge")}</div>
          <div className="kpi-value kpi-value-sm">
            {nextCharge?.nextChargeDate
              ? `${new Intl.DateTimeFormat(locale).format(nextCharge.nextChargeDate)} · ${t("inDays")} ${nextChargeDays} ${t("days")}`
              : "-"}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            {t("costsSummaryRisk")} {settings?.defaultAlertDays ?? 30} {t("days")})
          </div>
          <div className={`kpi-value ${riskTotal > 0 ? "kpi-value-risk" : ""}`}>
            {formatCurrency(riskTotal, displayCurrency, locale)}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("frequency")}</div>
          <div className="kpi-value kpi-breakdown">
            <div>{t("weekly")}: {weeklyCostsCount}</div>
            <div>{t("monthly")}: {monthlyCostsCount}</div>
            <div>{t("yearly")}: {yearlyCostsCount}</div>
          </div>
        </div>
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <div className="panel cost-form-panel">
        <div className="panel-title">{addCostLabel || "Add cost"}</div>
        <form id="cost-form" action={createCost} className="form-grid">
          <input name="name" placeholder={t("name")} required />
          <input name="supplier" placeholder={t("supplier")} />
          <input name="category" placeholder={t("category")} />
          <input
            name="amount"
            placeholder={t("amount")}
            type="number"
            step="0.01"
            min="0"
            required
          />
          <select name="currency" defaultValue={displayCurrency}>
            <option value="USD">USD</option>
            <option value="NOK">NOK</option>
            <option value="EUR">EUR</option>
          </select>
          <select name="frequency" defaultValue="MONTHLY">
            <option value="MONTHLY">MONTHLY</option>
            <option value="YEARLY">YEARLY</option>
            <option value="WEEKLY">WEEKLY</option>
          </select>
        </form>
        <div className="form-actions">
          <button
            type="submit"
            form="cost-form"
            className="form-primary"
            aria-label={addCostLabel || "Add cost"}
          >
            {addCostLabel || (language === "NO" ? "Legg til kostnad" : "Add cost")}
          </button>
        </div>
      </div>
      <div className="view-switch">
        <Link className={`view-switch-item ${!showDeleted ? "active" : ""}`} href="/costs">
          {t("activeItems")}
        </Link>
        <Link className={`view-switch-item view-switch-item-secondary ${showDeleted ? "active" : ""}`} href="/costs?view=deleted">
          {t("deletedItems")}
        </Link>
      </div>

      {!showDeleted && sortedCosts.length === 0 ? (
        <p className="muted">{t("noCosts")}</p>
      ) : !showDeleted ? (
        <div className="table-wrap">
        <CostsControls
          filterLabel={t("filterBy")}
          sortLabel={t("sortBy")}
          allLabel={t("allFrequencies")}
          weeklyLabel={t("weekly")}
          monthlyLabel={t("monthly")}
          yearlyLabel={t("yearly")}
          sortNextPaymentLabel={t("sortNextPayment")}
          sortAmountHighLabel={t("sortAmountHigh")}
          sortAmountLowLabel={t("sortAmountLow")}
          sortVendorLabel={t("sortVendor")}
          selectedFilter={selectedFilter}
          selectedSort={selectedSort}
        />
        <table className="table">
          <thead>
            <tr>
              <th>{t("vendor")}</th>
              <th className="num">{t("amount")}</th>
              <th>{t("frequency")}</th>
              <th>{t("nextCharge")}</th>
              <th className="num">{t("shownIn")} ({baseCurrency})</th>
              <th>{t("createdAt")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedCosts.map(({ cost, amount, amountInBase, nextChargeDate }) => {

              return (
                <tr key={cost.id}>
                  <td>{cost.supplier ?? "-"}</td>
                  <td className="num">
                    {Number.isFinite(amount)
                      ? formatCurrency(amount, cost.currency, locale)
                      : "-"}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        cost.frequency === "MONTHLY"
                          ? "status-safe"
                          : cost.frequency === "YEARLY"
                            ? "status-info"
                            : "status-weekly"
                      }`}
                    >
                      {cost.frequency}
                    </span>
                  </td>
                  <td>
                    {nextChargeDate
                      ? `${new Intl.DateTimeFormat(locale).format(nextChargeDate)} (${t("inDays")} ${daysUntil(nextChargeDate, now)} ${t("days")})`
                      : "-"}
                  </td>
                  <td className="num">
                    {Number.isFinite(amountInBase)
                      ? formatCurrency(amountInBase, baseCurrency, locale)
                      : "-"}
                  </td>
                  <td>{new Intl.DateTimeFormat(locale).format(cost.createdAt)}</td>
                  <td>
                    <div className="actions-row">
                      <Link className="ghost icon-action edit-action" href={`/costs/${cost.id}/edit`} title={t("edit")} aria-label={t("edit")}>
                        ✎
                      </Link>
                      <ConfirmDeleteForm
                        action={deleteCost}
                        id={cost.id}
                        label="🗑"
                        className="ghost danger-ghost icon-action"
                        confirmText={confirmDelete}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      ) : deletedCosts.length > 0 ? (
        <>
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("vendor")}</th>
                <th>{t("category")}</th>
                <th className="num">{t("amount")}</th>
                <th>{t("currency")}</th>
                <th>{t("frequency")}</th>
                <th>{t("createdAt")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {deletedCosts.map((cost) => (
                <tr key={cost.id}>
                  <td>{cost.supplier ?? "-"}</td>
                  <td>{cost.category ?? "-"}</td>
                  <td className="num">
                    {formatCurrency(Number(cost.amount), cost.currency, locale)}
                  </td>
                  <td>{cost.currency}</td>
                  <td>{cost.frequency}</td>
                  <td>{new Intl.DateTimeFormat(locale).format(cost.createdAt)}</td>
                  <td>
                    <div className="actions-row">
                      <form action={restoreCost}>
                        <input type="hidden" name="id" value={cost.id} />
                        <button type="submit" className="ghost">
                          {t("restore")}
                        </button>
                      </form>
                      <ConfirmDeleteForm
                        action={deleteCostForever}
                        id={cost.id}
                        label="🗑"
                        className="ghost danger-ghost icon-action"
                        confirmText={confirmDeleteForever}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <p className="muted">{t("noDeletedCosts")}</p>
      )}
    </div>
  );
  });
}

