import { prisma } from "@/lib/prisma";
import {
  convertWithUsdRates,
  formatCurrency,
  getUsdRates,
} from "@/lib/currency";
import { getTranslations } from "@/lib/i18n";
import { requireCompanyId } from "@/lib/session";
import { Currency } from "@prisma/client";
import Link from "next/link";
import { withRequestContext, withTiming } from "@/lib/observability";
import { getSettingsCached } from "@/lib/cached-data";

export const runtime = "nodejs";

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export default async function Page() {
  const companyId = await requireCompanyId();
  return withRequestContext({ route: "/dashboard", companyId }, async () => {
  const settings = await withTiming("dashboard.settings", () =>
    getSettingsCached(companyId)
  );
  const { t, language } = getTranslations(settings?.language);
  const baseCurrency: Currency = settings?.baseCurrency ?? "USD";
  const displayCurrency: Currency = settings?.displayCurrency ?? "USD";
  const locale = language === "NO" ? "nb-NO" : "en-US";
  const defaultAlertDays = settings?.defaultAlertDays ?? 30;

  const usdRates = await getUsdRates();

  const [costs, contracts, ledgerEntries] = await withTiming("dashboard.summary_data", () =>
    Promise.all([
      prisma.cost.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true,
          amount: true,
          currency: true,
          frequency: true,
          isActive: true,
        },
      }),
      prisma.contract.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true,
          status: true,
          name: true,
          supplier: true,
          endDate: true,
          renewalDate: true,
          cancelByDate: true,
          alertDays: true,
          pricePerMonth: true,
          currency: true,
        },
      }),
      prisma.ledgerEntry.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true,
          type: true,
          amount: true,
        },
      }),
    ])
  );

  const monthlyTotal = costs
    .filter((cost) => cost.isActive)
    .reduce((sum, cost) => {
      const amount = Number(cost.amount);
      if (!Number.isFinite(amount)) {
        return sum;
      }
      const amountInBase = convertWithUsdRates(
        amount,
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

      const frequency = cost.frequency.toUpperCase();
      if (frequency === "YEARLY" || frequency === "ANNUAL") {
        return sum + amountInDisplay / 12;
      }
      if (frequency === "WEEKLY") {
        return sum + amountInDisplay * (52 / 12);
      }
      return Number.isFinite(amountInDisplay) ? sum + amountInDisplay : sum;
    }, 0);

  const activeContractsCount = contracts.filter(
    (contract) =>
      contract.status === "ACTIVE" || contract.status === "EXPIRING"
  ).length;

  const incomeTotal = ledgerEntries
    .filter((entry) => entry.type === "INCOME")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const expenseTotal = ledgerEntries
    .filter((entry) => entry.type === "EXPENSE")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const netTotal = incomeTotal - expenseTotal;

  const now = new Date();
  const expiringSoon = contracts.filter((contract) => {
    if (!contract.endDate) {
      return false;
    }
    if (contract.status === "TERMINATED") {
      return false;
    }
    const alertDays = contract.alertDays ?? defaultAlertDays;
    return contract.endDate <= addDays(now, alertDays);
  });

  const cancelBySoon = contracts.filter((contract) => {
    if (!contract.cancelByDate) {
      return false;
    }
    if (contract.status === "TERMINATED") {
      return false;
    }
    const alertDays = contract.alertDays ?? defaultAlertDays;
    return contract.cancelByDate <= addDays(now, alertDays);
  });

  const renewalsSoon = contracts.filter((contract) => {
    if (!contract.renewalDate) {
      return false;
    }
    if (contract.status === "TERMINATED") {
      return false;
    }
    const alertDays = contract.alertDays ?? defaultAlertDays;
    return contract.renewalDate <= addDays(now, alertDays);
  });

  const riskyContracts = contracts.filter((contract) => {
    if (contract.status === "TERMINATED") {
      return false;
    }
    if (!contract.renewalDate && !contract.endDate) {
      return false;
    }
    const alertDays = contract.alertDays ?? defaultAlertDays;
    const renewalInWindow = contract.renewalDate
      ? contract.renewalDate <= addDays(now, alertDays)
      : false;
    const endingInWindow = contract.endDate
      ? contract.endDate <= addDays(now, alertDays)
      : false;
    return renewalInWindow || endingInWindow;
  });

  const monthlyRiskCost = riskyContracts.reduce((sum, contract) => {
    const amount = Number(contract.pricePerMonth ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return sum;
    }
    const contractCurrency = contract.currency ?? baseCurrency;
    const inBase = convertWithUsdRates(
      amount,
      contractCurrency,
      baseCurrency,
      usdRates
    );
    const inDisplay = convertWithUsdRates(
      inBase,
      baseCurrency,
      displayCurrency,
      usdRates
    );
    return Number.isFinite(inDisplay) ? sum + inDisplay : sum;
  }, 0);
  const hasRisk = cancelBySoon.length > 0 || riskyContracts.length > 0;
  const riskDays = defaultAlertDays;

  return (
    <div className="page dashboard-page">
      <h1 className="page-title">{t("dashboard")}</h1>
      <p className="page-hero">{t("dashboardHero")}</p>
      <p className="muted">{t("dashboardSubtitle")}</p>
      <section className={`alert-panel ${hasRisk ? "alert-panel-danger" : "alert-panel-safe"}`}>
        <div className="alert-panel-header">
          <span className={`badge ${hasRisk ? "badge-danger" : "badge-safe"}`}>
            {hasRisk ? t("urgent") : t("notice")}
          </span>
          <h2>{hasRisk ? t("dashboardActionTitle") : t("dashboardActionSafeTitle")}</h2>
        </div>
        <p className="muted">{hasRisk ? t("dashboardActionText") : t("dashboardActionSafeText")}</p>
        <div className="alert-panel-row">
          <div>
            <div className="card-label">{t("dashboardActionCostAtRisk")}</div>
            <div className="alert-panel-value">
              {formatCurrency(monthlyRiskCost, displayCurrency, locale)}
            </div>
          </div>
          <div>
            <div className="card-label">
              {t("expiringWithin")} ({riskDays} {t("days")} {t("left")})
            </div>
            <div className="alert-panel-value">{riskyContracts.length}</div>
          </div>
          <Link className="form-primary" href="/contracts">
            {t("dashboardActionButton")}
          </Link>
        </div>
      </section>
      <div className="card-grid">
        <div className="card card-neutral">
          <div className="card-label">{t("monthlyFixedCosts")}</div>
          <div className="card-value">
            {formatCurrency(monthlyTotal, displayCurrency, locale)}
          </div>
        </div>
        <div className="card card-safe">
          <div className="card-label">{t("activeContracts")}</div>
          <div className="card-value">{activeContractsCount}</div>
        </div>
        <div className="card card-warning">
          <div className="card-label">
            {t("expiringWithin")} ({defaultAlertDays} {t("days")} {t("left")})
          </div>
          <div className="card-value">{expiringSoon.length}</div>
        </div>
        <div className="card card-danger">
          <div className="card-label">
            {t("cancelByWithin")} {defaultAlertDays} {t("days")}
          </div>
          <div className="card-value">{cancelBySoon.length}</div>
        </div>
        <div className="card card-warning">
          <div className="card-label">
            {t("renewalWithin")} {defaultAlertDays} {t("days")}
          </div>
          <div className="card-value">{renewalsSoon.length}</div>
        </div>
      </div>
      <h2 className="section-title">{t("accountingSecondary")}</h2>
      <div className="card-grid card-grid-secondary">
        <div className="card card-subtle">
          <div className="card-label">{t("incomeTotal")}</div>
          <div className="card-value">
            {formatCurrency(incomeTotal, baseCurrency, locale)}
          </div>
        </div>
        <div className="card card-subtle">
          <div className="card-label">{t("expenseTotal")}</div>
          <div className="card-value">
            {formatCurrency(expenseTotal, baseCurrency, locale)}
          </div>
        </div>
        <div className="card card-subtle">
          <div className="card-label">{t("netTotal")}</div>
          <div className="card-value">
            {formatCurrency(netTotal, baseCurrency, locale)}
          </div>
        </div>
      </div>

      <h2 className="section-title">{t("expiringContracts")}</h2>
      {expiringSoon.length === 0 ? (
        <p className="muted">{t("noExpiringContracts")}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("supplier")}</th>
              <th>{t("endDate")}</th>
            </tr>
          </thead>
          <tbody>
            {expiringSoon.map((contract) => (
              <tr key={contract.id}>
                <td>{contract.name}</td>
                <td>{contract.supplier ?? "-"}</td>
                <td>
                  {contract.endDate
                    ? new Intl.DateTimeFormat(locale).format(
                        contract.endDate
                      )
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="section-title">{t("cancelByContracts")}</h2>
      {cancelBySoon.length === 0 ? (
        <p className="muted">{t("noCancelByContracts")}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("supplier")}</th>
              <th>{t("cancelByDate")}</th>
            </tr>
          </thead>
          <tbody>
            {cancelBySoon.map((contract) => (
              <tr key={contract.id}>
                <td>{contract.name}</td>
                <td>{contract.supplier ?? "-"}</td>
                <td>
                  {contract.cancelByDate ? (
                    <span className="badge badge-warning">
                      {"\u26A0"}{" "}
                      {new Intl.DateTimeFormat(locale).format(
                        contract.cancelByDate
                      )}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="section-title">{t("renewalContracts")}</h2>
      {renewalsSoon.length === 0 ? (
        <p className="muted">{t("noRenewalContracts")}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("supplier")}</th>
              <th>{t("renewalDate")}</th>
            </tr>
          </thead>
          <tbody>
            {renewalsSoon.map((contract) => (
              <tr key={contract.id}>
                <td>{contract.name}</td>
                <td>{contract.supplier ?? "-"}</td>
                <td>
                  {contract.renewalDate
                    ? new Intl.DateTimeFormat(locale).format(
                        contract.renewalDate
                      )
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
  });
}


