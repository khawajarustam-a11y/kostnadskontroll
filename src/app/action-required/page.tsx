import Link from "next/link";
import { Currency } from "@prisma/client";
import { getSettingsCached } from "@/lib/cached-data";
import { convertWithUsdRates, formatCurrency, getUsdRates } from "@/lib/currency";
import { getContractRisk, getComputedStatus, type ContractRiskKind } from "@/lib/contract-risk";
import { getTranslations, type TranslationKey } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { withRequestContext, withTiming } from "@/lib/observability";

export const runtime = "nodejs";

function getRiskClass(severity: string) {
  if (severity === "danger") return "badge-danger";
  if (severity === "warning") return "badge-warning";
  return "badge-safe";
}

function riskTranslationKey(kind: ContractRiskKind): TranslationKey {
  if (kind === "cancel") return "risk_cancel";
  if (kind === "renewal") return "risk_renewal";
  if (kind === "expiry") return "risk_expiry";
  return "risk_expired";
}

export default async function Page() {
  const companyId = await requireCompanyId();

  return withRequestContext({ route: "/action-required", companyId }, async () => {
    const settings = await withTiming("action_required.settings", () =>
      getSettingsCached(companyId)
    );
    const { t, language } = getTranslations(settings?.language);
    const baseCurrency: Currency = settings?.baseCurrency ?? "USD";
    const displayCurrency: Currency = settings?.displayCurrency ?? "USD";
    const locale = language === "NO" ? "nb-NO" : "en-US";
    const defaultAlertDays = settings?.defaultAlertDays ?? 30;
    const now = new Date();
    const usdRates = await getUsdRates();

    const contracts = await withTiming("action_required.contracts", () =>
      prisma.contract.findMany({
        where: { companyId, deletedAt: null },
        orderBy: [{ cancelByDate: "asc" }, { renewalDate: "asc" }, { endDate: "asc" }],
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
      })
    );

    const riskItems = contracts
      .map((contract) => ({
        contract,
        computedStatus: getComputedStatus(contract.endDate, contract.cancelByDate, now),
        risk: getContractRisk(contract, now, defaultAlertDays),
      }))
      .filter((item) => item.risk !== null)
      .sort((a, b) => {
        const severityA = a.risk?.severity === "danger" ? 0 : 1;
        const severityB = b.risk?.severity === "danger" ? 0 : 1;
        if (severityA !== severityB) return severityA - severityB;
        return (a.risk?.days ?? 0) - (b.risk?.days ?? 0);
      });

    const moneyAtRisk = riskItems.reduce((sum, item) => {
      const amount = Number(item.contract.pricePerMonth ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      const contractCurrency = item.contract.currency ?? baseCurrency;
      const inBase = convertWithUsdRates(amount, contractCurrency, baseCurrency, usdRates);
      const inDisplay = convertWithUsdRates(inBase, baseCurrency, displayCurrency, usdRates);
      return Number.isFinite(inDisplay) ? sum + inDisplay : sum;
    }, 0);

    const cancellationCount = riskItems.filter((item) => item.risk?.kind === "cancel").length;
    const renewalCount = riskItems.filter((item) => item.risk?.kind === "renewal").length;
    const expiredCount = riskItems.filter((item) => item.risk?.kind === "expired").length;

    return (
      <div className="page action-page">
        <div className="page-header">
          <p className="eyebrow">{t("protectionCenter")}</p>
          <h1 className="page-title">{t("actionRequired")}</h1>
          <p className="page-hero">{t("actionRequiredHero")}</p>
          <p className="muted">{t("actionRequiredSubtitle")}</p>
        </div>

        <div className="kpi-row">
          <div className="kpi kpi-danger">
            <div className="kpi-label">{t("itemsNeedAttention")}</div>
            <div className="kpi-value">{riskItems.length}</div>
          </div>
          <div className="kpi kpi-warning">
            <div className="kpi-label">{t("moneyAtRisk")}</div>
            <div className="kpi-value">{formatCurrency(moneyAtRisk, displayCurrency, locale)}</div>
          </div>
          <div className="kpi kpi-safe">
            <div className="kpi-label">{t("deadlinesMonitored")}</div>
            <div className="kpi-value">{contracts.length}</div>
          </div>
        </div>

        <div className="protection-strip">
          <div>
            <div className="card-label">{t("cancelDeadlines")}</div>
            <strong>{cancellationCount}</strong>
          </div>
          <div>
            <div className="card-label">{t("renewalRisks")}</div>
            <strong>{renewalCount}</strong>
          </div>
          <div>
            <div className="card-label">{t("expiredContracts")}</div>
            <strong>{expiredCount}</strong>
          </div>
        </div>

        {riskItems.length === 0 ? (
          <section className="alert-panel alert-panel-safe">
            <div className="alert-panel-header">
              <span className="badge badge-safe">{t("notice")}</span>
              <h2>{t("emptyActionTitle")}</h2>
            </div>
            <p className="muted">{t("emptyActionText")}</p>
            <div className="alert-panel-row">
              <Link className="form-primary" href="/import">
                {t("importFirstContract")}
              </Link>
              <Link className="form-secondary" href="/contracts/new">
                {t("addContractManually")}
              </Link>
            </div>
          </section>
        ) : (
          <div className="action-list">
            {riskItems.map(({ contract, computedStatus, risk }) => {
              if (!risk) return null;
              const dateLabel = new Intl.DateTimeFormat(locale).format(risk.dueDate);
              const amount = Number(contract.pricePerMonth ?? 0);
              const contractCurrency = contract.currency ?? baseCurrency;
              const inBase = Number.isFinite(amount)
                ? convertWithUsdRates(amount, contractCurrency, baseCurrency, usdRates)
                : 0;
              const inDisplay = convertWithUsdRates(inBase, baseCurrency, displayCurrency, usdRates);

              return (
                <article className={"action-item action-item-" + risk.severity} key={contract.id}>
                  <div>
                    <span className={"badge " + getRiskClass(risk.severity)}>
                      {t(riskTranslationKey(risk.kind))}
                    </span>
                    <h2>{contract.name}</h2>
                    <p className="muted">{contract.supplier ?? t("unknownSupplier")}</p>
                  </div>
                  <div>
                    <div className="card-label">{t("deadline")}</div>
                    <strong>{dateLabel}</strong>
                    <p className="muted">
                      {risk.kind === "expired"
                        ? t("expiredAgo") + " " + risk.days + " " + t("days")
                        : risk.days + " " + t("days") + " " + t("left")}
                    </p>
                  </div>
                  <div>
                    <div className="card-label">{t("possibleCharge")}</div>
                    <strong>{formatCurrency(Number.isFinite(inDisplay) ? inDisplay : 0, displayCurrency, locale)}</strong>
                    <p className="muted">{computedStatus}</p>
                  </div>
                  <div className="action-buttons">
                    <Link className="form-primary" href={"/contracts/" + contract.id + "/edit"}>
                      {t("review")}
                    </Link>
                    <Link className="form-secondary" href="/contracts">
                      {t("viewAll")}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  });
}
