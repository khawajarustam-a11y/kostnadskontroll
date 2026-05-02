import ConfirmDeleteForm from "@/components/ConfirmDeleteForm";
import { getTranslations } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { ContractStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { withRequestContext, withTiming } from "@/lib/observability";
import { getSettingsCached } from "@/lib/cached-data";
import { formatCurrency } from "@/lib/currency";

export const runtime = "nodejs";

function daysUntil(date: Date, now: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / msPerDay));
}

function daysSince(date: Date, now: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((now.getTime() - date.getTime()) / msPerDay));
}

function getComputedStatus(
  endDate: Date | null,
  cancelByDate: Date | null,
  now: Date
): ContractStatus {
  const endInDays =
    endDate && endDate >= now ? daysUntil(endDate, now) : null;
  const cancelInDays =
    cancelByDate && cancelByDate >= now ? daysUntil(cancelByDate, now) : null;

  if (endDate && endDate < now) {
    return "TERMINATED";
  }
  if (
    (endInDays !== null && endInDays <= 60) ||
    (cancelInDays !== null && cancelInDays <= 30)
  ) {
    return "EXPIRING";
  }
  return "ACTIVE";
}

async function deleteContract(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.contract.updateMany({
    where: { id, companyId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
}

async function restoreContract(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.contract.updateMany({
    where: { id, companyId },
    data: { deletedAt: null },
  });
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
}

async function deleteContractForever(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.contract.deleteMany({
    where: { id, companyId },
  });
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; view?: string }>;
}) {
  const companyId = await requireCompanyId();
  return withRequestContext({ route: "/contracts", companyId }, async () => {
  const settings = await withTiming("contracts.settings", () =>
    getSettingsCached(companyId)
  );
  const { t, language } = getTranslations(settings?.language);
  const locale = language === "NO" ? "nb-NO" : "en-US";
  const defaultAlertDays = settings?.defaultAlertDays ?? 30;
  const { error, view } = searchParams ? await searchParams : {};
  const showDeleted = view === "deleted";
  const errorMessage =
    error === "invalid_date_range"
      ? t("errorInvalidDateRange")
      : error === "invalid_contract"
        ? t("errorInvalidContract")
        : null;
  const confirmDelete = t("confirmDelete");
  const confirmDeleteForever = t("confirmDeleteForever");

  const [contracts, deletedContracts] = await withTiming("contracts.list_data", () =>
    Promise.all([
      prisma.contract.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { endDate: "asc" },
        select: {
          id: true,
          name: true,
          supplier: true,
          status: true,
          startDate: true,
          endDate: true,
          renewalDate: true,
          cancelByDate: true,
          pricePerMonth: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.contract.findMany({
        where: { companyId, deletedAt: { not: null } },
        orderBy: { endDate: "asc" },
        select: {
          id: true,
          name: true,
          supplier: true,
          status: true,
          endDate: true,
          renewalDate: true,
          cancelByDate: true,
          pricePerMonth: true,
          currency: true,
          createdAt: true,
        },
      }),
    ])
  );

  const now = new Date();
  const contractsWithComputedStatus = contracts.map((contract) => {
    const computedStatus = getComputedStatus(
      contract.endDate,
      contract.cancelByDate,
      now
    );
    return { contract, computedStatus };
  });
  const activeCount = contractsWithComputedStatus.filter(
    (c) => c.computedStatus === "ACTIVE"
  ).length;
  const expiringCount = contractsWithComputedStatus.filter(
    (c) => c.computedStatus === "EXPIRING"
  ).length;
  const terminatedCount = contractsWithComputedStatus.filter(
    (c) => c.computedStatus === "TERMINATED"
  ).length;

  function getStatusClass(status: ContractStatus) {
    if (status === "ACTIVE") return "status-safe";
    if (status === "EXPIRING") return "status-warning";
    return "status-danger";
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t("contracts")}</h1>
        <p className="muted">{t("contractsSubtitle")}</p>
        <div className="page-actions">
          <Link className="form-primary" href="/contracts/new">
            {t("addContract")}
          </Link>
          <Link className="form-secondary" href="/import">
            {t("importData")}
          </Link>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi kpi-safe">
          <div className="kpi-label">{t("active")}</div>
          <div className="kpi-value">{activeCount}</div>
        </div>
        <div className="kpi kpi-warning">
          <div className="kpi-label">{t("expiring")}</div>
          <div className="kpi-value">{expiringCount}</div>
        </div>
        <div className="kpi kpi-danger">
          <div className="kpi-label">{t("terminated")}</div>
          <div className="kpi-value">{terminatedCount}</div>
        </div>
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <div className="view-switch">
        <Link className={`view-switch-item ${!showDeleted ? "active" : ""}`} href="/contracts">
          {t("activeItems")}
        </Link>
        <Link className={`view-switch-item view-switch-item-secondary ${showDeleted ? "active" : ""}`} href="/contracts?view=deleted">
          {t("deletedItems")}
        </Link>
      </div>

      {!showDeleted ? (
        contracts.length === 0 ? (
          <p className="muted">{t("noContracts")}</p>
        ) : (
          <div className="table-wrap">
            <table className="table contracts-table">
              <thead>
                <tr>
                  <th>{t("name")}</th>
                  <th>{t("supplier")}</th>
                  <th className="num">{t("amount")}</th>
                  <th>{t("status")}</th>
                  <th>{t("importantDates")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {contractsWithComputedStatus.map(({ contract, computedStatus }) => {
                  const endInDays = contract.endDate ? daysUntil(contract.endDate, now) : null;
                  const cancelInDays = contract.cancelByDate ? daysUntil(contract.cancelByDate, now) : null;
                  const cancelSoon =
                    cancelInDays !== null &&
                    contract.cancelByDate !== null &&
                    contract.cancelByDate >= now &&
                    cancelInDays <= defaultAlertDays &&
                    computedStatus !== "TERMINATED";
                  const cancelUrgent =
                    cancelInDays !== null &&
                    contract.cancelByDate !== null &&
                    contract.cancelByDate >= now &&
                    cancelInDays < 14 &&
                    computedStatus !== "TERMINATED";
                  const expiringSoon =
                    endInDays !== null &&
                    contract.endDate !== null &&
                    contract.endDate >= now &&
                    endInDays <= 60 &&
                    computedStatus !== "TERMINATED";

                  return (
                    <tr
                      key={contract.id}
                      className={
                        expiringSoon || cancelSoon || computedStatus === "EXPIRING"
                          ? "row-warning-soft"
                          : undefined
                      }
                    >
                      <td className="table-primary">
                        <div className="stack" style={{ gap: 4 }}>
                          <span>{contract.name}</span>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {t("createdAt")}: {new Intl.DateTimeFormat(locale).format(contract.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="muted">{contract.supplier ?? "-"}</td>
                      <td className="num">
                        {contract.pricePerMonth && contract.currency
                          ? formatCurrency(Number(contract.pricePerMonth), contract.currency, locale)
                          : "-"}
                      </td>
                      <td>
                        <span className={`status-pill ${getStatusClass(computedStatus)}`}>
                          {computedStatus}
                        </span>
                      </td>
                      <td>
                        <div className="stack" style={{ gap: 6 }}>
                          <span>
                            <span className="muted">{t("endDate")}:</span>{" "}
                            {contract.endDate ? new Intl.DateTimeFormat(locale).format(contract.endDate) : "-"}
                          </span>
                          {contract.endDate ? (
                            contract.endDate < now ? (
                              <span className="muted" style={{ fontSize: 12 }}>
                                {language === "NO"
                                  ? `Utløpt for ${daysSince(contract.endDate, now)} dager siden`
                                  : `Expired ${daysSince(contract.endDate, now)} days ago`}
                              </span>
                            ) : endInDays !== null &&
                              contract.endDate >= now &&
                              computedStatus !== "TERMINATED" ? (
                              <span className="muted" style={{ fontSize: 12 }}>
                                {t("expiresIn")} {endInDays} {t("days")}
                              </span>
                            ) : null
                          ) : null}
                          <span>
                            <span className="muted">{t("renewalDate")}:</span>{" "}
                            {contract.renewalDate ? new Intl.DateTimeFormat(locale).format(contract.renewalDate) : "-"}
                          </span>
                          <span>
                            <span className="muted">{t("cancelByDate")}:</span>{" "}
                            {contract.cancelByDate ? (
                              contract.cancelByDate < now && computedStatus !== "TERMINATED" ? (
                                <span className="badge badge-warning">{t("cancellationWindowPassed")}</span>
                              ) : cancelUrgent && cancelInDays !== null ? (
                                <span className="badge badge-warning">
                                  {"\u26A0"} {language === "NO" ? "Handling kreves" : "Action required"}:{" "}
                                  {t("cancelWithin")} {cancelInDays} {t("days")}
                                </span>
                              ) : cancelSoon && cancelInDays !== null ? (
                                <span className="badge badge-danger">
                                  {t("cancelWithin")} {cancelInDays} {t("days")}
                                </span>
                              ) : (
                                new Intl.DateTimeFormat(locale).format(contract.cancelByDate)
                              )
                            ) : (
                              "-"
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="actions-row">
                          <Link
                            className="ghost icon-action edit-action"
                            href={`/contracts/${contract.id}/edit`}
                            title={t("edit")}
                            aria-label={t("edit")}
                          >
                            {"\u270E"}
                          </Link>
                          <ConfirmDeleteForm
                            action={deleteContract}
                            id={contract.id}
                            label={"\u{1F5D1}"}
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
        )
      ) : deletedContracts.length > 0 ? (
        <div className="table-wrap">
          <table className="table contracts-table">
            <thead>
              <tr>
                <th>{t("name")}</th>
                <th>{t("supplier")}</th>
                <th className="num">{t("amount")}</th>
                <th>{t("status")}</th>
                <th>{t("importantDates")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {deletedContracts.map((contract) => (
                <tr key={contract.id}>
                  <td className="table-primary">
                    <div className="stack" style={{ gap: 4 }}>
                      <span>{contract.name}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {t("createdAt")}: {new Intl.DateTimeFormat(locale).format(contract.createdAt)}
                      </span>
                    </div>
                  </td>
                  <td className="muted">{contract.supplier ?? "-"}</td>
                  <td className="num">
                    {contract.pricePerMonth && contract.currency
                      ? formatCurrency(Number(contract.pricePerMonth), contract.currency, locale)
                      : "-"}
                  </td>
                  <td>
                    <span className={`status-pill ${getStatusClass(contract.status)}`}>{contract.status}</span>
                  </td>
                  <td>
                    <div className="stack" style={{ gap: 6 }}>
                      <span>
                        <span className="muted">{t("endDate")}:</span>{" "}
                        {contract.endDate ? new Intl.DateTimeFormat(locale).format(contract.endDate) : "-"}
                      </span>
                      <span>
                        <span className="muted">{t("renewalDate")}:</span>{" "}
                        {contract.renewalDate ? new Intl.DateTimeFormat(locale).format(contract.renewalDate) : "-"}
                      </span>
                      <span>
                        <span className="muted">{t("cancelByDate")}:</span>{" "}
                        {contract.cancelByDate ? new Intl.DateTimeFormat(locale).format(contract.cancelByDate) : "-"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="actions-row">
                      <form action={restoreContract}>
                        <input type="hidden" name="id" value={contract.id} />
                        <button type="submit" className="ghost">
                          {t("restore")}
                        </button>
                      </form>
                      <ConfirmDeleteForm
                        action={deleteContractForever}
                        id={contract.id}
                        label={"\u{1F5D1}"}
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
      ) : (
        <p className="muted">{t("noDeletedContracts")}</p>
      )}
    </div>
  );
  });
}
