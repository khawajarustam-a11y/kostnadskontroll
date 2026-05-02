import Link from "next/link";
import { Currency } from "@prisma/client";
import { getSettingsCached } from "@/lib/cached-data";
import { getContractRisk, getComputedStatus } from "@/lib/contract-risk";
import { convertWithUsdRates, formatCurrency, getUsdRates } from "@/lib/currency";
import { getTranslations } from "@/lib/i18n";
import { withRequestContext, withTiming } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";

export const runtime = "nodejs";

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
    const now = new Date();
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
        if (!Number.isFinite(amount)) return sum;
        const amountInBase = convertWithUsdRates(amount, cost.currency, baseCurrency, usdRates);
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

    const contractsWithRisk = contracts.map((contract) => {
      const computedStatus = getComputedStatus(contract.endDate, contract.cancelByDate, now);
      const risk = getContractRisk(contract, now, defaultAlertDays);
      return { contract, computedStatus, risk };
    });

    const activeContractsCount = contractsWithRisk.filter(
      ({ computedStatus }) => computedStatus === "ACTIVE"
    ).length;

    const riskItems = contractsWithRisk
      .filter(({ risk }) => risk !== null)
      .sort((a, b) => {
        const severityA = a.risk?.severity === "danger" ? 0 : 1;
        const severityB = b.risk?.severity === "danger" ? 0 : 1;
        if (severityA !== severityB) return severityA - severityB;
        return (a.risk?.days ?? 0) - (b.risk?.days ?? 0);
      });

    const cancelBySoon = riskItems.filter(({ risk }) => risk?.kind === "cancel");
    const renewalsSoon = riskItems.filter(({ risk }) => risk?.kind === "renewal");
    const chargesComingSoon = riskItems.filter(
      ({ risk }) => risk?.kind === "renewal" || risk?.kind === "expiry"
    );

    const moneyAtRisk = riskItems.reduce((sum, { contract }) => {
      const amount = Number(contract.pricePerMonth ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      const contractCurrency = contract.currency ?? baseCurrency;
      const inBase = convertWithUsdRates(amount, contractCurrency, baseCurrency, usdRates);
      const inDisplay = convertWithUsdRates(inBase, baseCurrency, displayCurrency, usdRates);
      return Number.isFinite(inDisplay) ? sum + inDisplay : sum;
    }, 0);

    const incomeTotal = ledgerEntries
      .filter((entry) => entry.type === "INCOME")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

    const expenseTotal = ledgerEntries
      .filter((entry) => entry.type === "EXPENSE")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

    const netTotal = incomeTotal - expenseTotal;
    const hasRisk = riskItems.length > 0;
    const riskDays = defaultAlertDays;
    const hasProtectedData = contracts.length > 0 || costs.length > 0;

    return (
      <div className="page dashboard-page">
        <p className="eyebrow">{t("protectionCenter")}</p>
        <h1 className="page-title">{t("dashboard")}</h1>
        <p className="page-hero">{t("dashboardHero")}</p>
        <p className="muted">{t("dashboardSubtitle")}</p>

        {!hasProtectedData ? (
          <section className="onboarding-panel">
            <div>
              <span className="badge badge-warning">{t("startHere")}</span>
              <h2>{t("onboardingTitle")}</h2>
              <p className="muted">{t("onboardingText")}</p>
            </div>
            <div className="onboarding-steps">
              <div>
                <strong>1</strong>
                <span>{t("onboardingStepImport")}</span>
              </div>
              <div>
                <strong>2</strong>
                <span>{t("onboardingStepReview")}</span>
              </div>
              <div>
                <strong>3</strong>
                <span>{t("onboardingStepProtect")}</span>
              </div>
            </div>
            <div className="page-actions">
              <Link className="form-primary" href="/import">
                {t("importFirstContract")}
              </Link>
              <Link className="form-secondary" href="/contracts/new">
                {t("addContractManually")}
              </Link>
            </div>
          </section>
        ) : null}

        <section className={"alert-panel " + (hasRisk ? "alert-panel-danger" : "alert-panel-safe")}>
          <div className="alert-panel-header">
            <span className={"badge " + (hasRisk ? "badge-danger" : "badge-safe")}>
              {hasRisk ? t("urgent") : t("notice")}
            </span>
            <h2>{hasRisk ? t("dashboardActionTitle") : t("dashboardActionSafeTitle")}</h2>
          </div>
          <p className="muted">{hasRisk ? t("dashboardActionText") : t("dashboardActionSafeText")}</p>
          <div className="alert-panel-row">
            <div>
              <div className="card-label">{t("moneyAtRisk")}</div>
              <div className="alert-panel-value">
                {formatCurrency(moneyAtRisk, displayCurrency, locale)}
              </div>
            </div>
            <div>
              <div className="card-label">
                {t("itemsNeedAttention")} ({riskDays} {t("days")})
              </div>
              <div className="alert-panel-value">{riskItems.length}</div>
            </div>
            <Link className="form-primary" href="/action-required">
              {t("dashboardActionButton")}
            </Link>
          </div>
        </section>

        <div className="card-grid">
          <div className="card card-danger">
            <div className="card-label">{t("moneyAtRisk")}</div>
            <div className="card-value">{formatCurrency(moneyAtRisk, displayCurrency, locale)}</div>
          </div>
          <div className="card card-safe">
            <div className="card-label">{t("protectedContracts")}</div>
            <div className="card-value">{activeContractsCount}</div>
          </div>
          <div className="card card-warning">
            <div className="card-label">{t("chargesComingSoon")} ({defaultAlertDays} {t("days")})</div>
            <div className="card-value">{chargesComingSoon.length}</div>
          </div>
          <div className="card card-danger">
            <div className="card-label">{t("cancelDeadlines")} {defaultAlertDays} {t("days")}</div>
            <div className="card-value">{cancelBySoon.length}</div>
          </div>
          <div className="card card-warning">
            <div className="card-label">{t("renewalRisks")} {defaultAlertDays} {t("days")}</div>
            <div className="card-value">{renewalsSoon.length}</div>
          </div>
          <div className="card card-neutral">
            <div className="card-label">{t("monthlyFixedCosts")}</div>
            <div className="card-value">{formatCurrency(monthlyTotal, displayCurrency, locale)}</div>
          </div>
        </div>

        <h2 className="section-title">{t("actionRequiredPreview")}</h2>
        {riskItems.length === 0 ? (
          <p className="muted">{t("allClearText")}</p>
        ) : (
          <div className="action-list action-list-compact">
            {riskItems.slice(0, 5).map(({ contract, risk }) => {
              if (!risk) return null;
              return (
                <article className={"action-item action-item-" + risk.severity} key={contract.id}>
                  <div>
                    <span className={"badge " + (risk.severity === "danger" ? "badge-danger" : "badge-warning")}>
                      {risk.kind === "cancel"
                        ? t("risk_cancel")
                        : risk.kind === "renewal"
                          ? t("risk_renewal")
                          : risk.kind === "expired"
                            ? t("risk_expired")
                            : t("risk_expiry")}
                    </span>
                    <h2>{contract.name}</h2>
                    <p className="muted">{contract.supplier ?? t("unknownSupplier")}</p>
                  </div>
                  <div>
                    <div className="card-label">{t("deadline")}</div>
                    <strong>{new Intl.DateTimeFormat(locale).format(risk.dueDate)}</strong>
                    <p className="muted">
                      {risk.kind === "expired"
                        ? t("expiredAgo") + " " + risk.days + " " + t("days")
                        : risk.days + " " + t("days") + " " + t("left")}
                    </p>
                  </div>
                  <Link className="form-secondary" href={"/contracts/" + contract.id + "/edit"}>
                    {t("review")}
                  </Link>
                </article>
              );
            })}
            {riskItems.length > 5 ? (
              <Link className="form-primary" href="/action-required">
                {t("viewAllActionItems")}
              </Link>
            ) : null}
          </div>
        )}

        <h2 className="section-title section-muted">{t("accountingSecondary")}</h2>
        <div className="card-grid card-grid-secondary">
          <div className="card card-subtle">
            <div className="card-label">{t("incomeTotal")}</div>
            <div className="card-value">{formatCurrency(incomeTotal, baseCurrency, locale)}</div>
          </div>
          <div className="card card-subtle">
            <div className="card-label">{t("expenseTotal")}</div>
            <div className="card-value">{formatCurrency(expenseTotal, baseCurrency, locale)}</div>
          </div>
          <div className="card card-subtle">
            <div className="card-label">{t("netTotal")}</div>
            <div className="card-value">{formatCurrency(netTotal, baseCurrency, locale)}</div>
          </div>
        </div>
      </div>
    );
  });
}
