import ConfirmDeleteForm from "@/components/ConfirmDeleteForm";
import { getTranslations } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { ContractStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { withRequestContext, withTiming } from "@/lib/observability";
import { parseOptionalDate } from "@/lib/validation";
import { getSettingsCached } from "@/lib/cached-data";

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

async function createContract(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const name = String(formData.get("name") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim();
  const startDateValue = String(formData.get("startDate") ?? "").trim();
  const endDateValue = String(formData.get("endDate") ?? "").trim();
  const renewalDateValue = String(formData.get("renewalDate") ?? "").trim();
  const cancelByDateValue = String(formData.get("cancelByDate") ?? "").trim();

  if (!name) {
    redirect("/contracts?error=invalid_contract");
  }

  const startDate = parseOptionalDate(startDateValue);
  const endDate = parseOptionalDate(endDateValue);
  const renewalDate = parseOptionalDate(renewalDateValue);
  const cancelByDate = parseOptionalDate(cancelByDateValue);

  if (startDate === "invalid" || endDate === "invalid" || renewalDate === "invalid" || cancelByDate === "invalid") {
    redirect("/contracts?error=invalid_contract");
  }
  if (startDate && endDate && endDate < startDate) redirect("/contracts?error=invalid_date_range");
  const computedStatus = getComputedStatus(endDate, cancelByDate, new Date());

  await prisma.contract.create({
    data: {
      companyId,
      name,
      supplier: supplier || null,
      status: computedStatus,
      startDate,
      endDate,
      renewalDate,
      cancelByDate,
    },
  });

  revalidatePath("/contracts");
  revalidatePath("/dashboard");
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
  const addContractLabel = t("addContract") || (language === "NO" ? "Legg til kontrakt" : "Add contract");
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

      <div className="panel">
        <div className="panel-title">{addContractLabel || "Add contract"}</div>
        <form id="contract-form" action={createContract} className="stack">
          <div className="form-section">
            <div className="form-section-title">{t("basicInfo")}</div>
            <div className="form-grid form-grid-3">
              <input name="name" placeholder={t("name")} required />
              <input name="supplier" placeholder={t("supplier")} />
              <input value={language === "NO" ? "Status beregnes automatisk" : "Status is calculated automatically"} disabled />
            </div>
          </div>
          <div className="form-section">
            <div className="form-section-title">{t("contractDates")}</div>
            <div className="form-grid form-grid-4">
              <label className="stack" style={{ gap: 4 }}>
                <span className="muted">{t("startDate")}</span>
                <input name="startDate" type="date" />
              </label>
              <label className="stack" style={{ gap: 4 }}>
                <span className="muted">{t("endDate")}</span>
                <input name="endDate" type="date" />
              </label>
              <label className="stack" style={{ gap: 4 }}>
                <span className="muted">{t("renewalDate")}</span>
                <input name="renewalDate" type="date" />
              </label>
              <label className="stack" style={{ gap: 4 }}>
                <span className="muted">{t("cancelByDate")}</span>
                <input name="cancelByDate" type="date" />
              </label>
            </div>
          </div>
        </form>
        <div className="form-actions">
          <button type="submit" form="contract-form" className="form-primary" aria-label={addContractLabel || "Add contract"}>
            {addContractLabel || (language === "NO" ? "Legg til kontrakt" : "Add contract")}
          </button>
        </div>
      </div>

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
                  <th>{t("status")}</th>
                  <th>{t("startDate")}</th>
                  <th>{t("endDate")}</th>
                  <th>{t("renewalDate")}</th>
                  <th>{t("cancelByDate")}</th>
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
                      <td className="table-primary">{contract.name}</td>
                      <td className="muted">{contract.supplier ?? "-"}</td>
                      <td>
                        <span className={`status-pill ${getStatusClass(computedStatus)}`}>
                          {computedStatus}
                        </span>
                      </td>
                      <td>{contract.startDate ? new Intl.DateTimeFormat(locale).format(contract.startDate) : "-"}</td>
                      <td className="table-primary">
                        {contract.endDate ? (
                          <div className="stack" style={{ gap: 4 }}>
                            <span>{new Intl.DateTimeFormat(locale).format(contract.endDate)}</span>
                            {contract.endDate < now ? (
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
                            ) : null}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{contract.renewalDate ? new Intl.DateTimeFormat(locale).format(contract.renewalDate) : "-"}</td>
                      <td>
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
                <th>{t("status")}</th>
                <th>{t("endDate")}</th>
                <th>{t("renewalDate")}</th>
                <th>{t("cancelByDate")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {deletedContracts.map((contract) => (
                <tr key={contract.id}>
                  <td className="table-primary">{contract.name}</td>
                  <td className="muted">{contract.supplier ?? "-"}</td>
                  <td>
                    <span className={`status-pill ${getStatusClass(contract.status)}`}>{contract.status}</span>
                  </td>
                  <td>{contract.endDate ? new Intl.DateTimeFormat(locale).format(contract.endDate) : "-"}</td>
                  <td>{contract.renewalDate ? new Intl.DateTimeFormat(locale).format(contract.renewalDate) : "-"}</td>
                  <td>{contract.cancelByDate ? new Intl.DateTimeFormat(locale).format(contract.cancelByDate) : "-"}</td>
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
