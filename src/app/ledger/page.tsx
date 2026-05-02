import { prisma } from "@/lib/prisma";
import { getTranslations } from "@/lib/i18n";
import { requireCompanyId } from "@/lib/session";
import { Currency, LedgerEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import ConfirmDeleteForm from "@/components/ConfirmDeleteForm";
import { convertWithUsdRates, formatCurrency, getUsdRates } from "@/lib/currency";
import Link from "next/link";
import { withRequestContext, withTiming } from "@/lib/observability";
import { parseCurrency, parseOptionalDate, parsePositiveAmount } from "@/lib/validation";
import { getSettingsCached } from "@/lib/cached-data";

export const runtime = "nodejs";

async function createEntry(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const type = String(formData.get("type") ?? "EXPENSE") as LedgerEntryType;
  const amount = parsePositiveAmount(formData.get("amount"));
  const currency = parseCurrency(formData.get("currency"));
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (amount === null || currency === null) {
    return;
  }

  const entryDate = parseOptionalDate(formData.get("entryDate"));
  if (entryDate === null || entryDate === "invalid") {
    return;
  }

  await prisma.ledgerEntry.create({
    data: {
      companyId,
      type,
      amount,
      currency,
      category: category || null,
      description: description || null,
      entryDate,
    },
  });

  revalidatePath("/ledger");
}

async function deleteEntry(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }
  await prisma.ledgerEntry.updateMany({
    where: { id, companyId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/ledger");
}

async function restoreEntry(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }
  await prisma.ledgerEntry.updateMany({
    where: { id, companyId },
    data: { deletedAt: null },
  });
  revalidatePath("/ledger");
}

async function deleteEntryForever(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }
  await prisma.ledgerEntry.deleteMany({
    where: { id, companyId },
  });
  revalidatePath("/ledger");
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const companyId = await requireCompanyId();
  return withRequestContext({ route: "/ledger", companyId }, async () => {
  const settings = await withTiming("ledger.settings", () =>
    getSettingsCached(companyId)
  );
  const { t, language } = getTranslations(settings?.language);
  const locale = language === "NO" ? "nb-NO" : "en-US";
  const { view } = searchParams ? await searchParams : {};
  const showDeleted = view === "deleted";
  const displayCurrency: Currency = settings?.displayCurrency === "NOK" ? "USD" : settings?.displayCurrency ?? "USD";
  const addEntryLabel = t("addEntry") || (language === "NO" ? "Legg til" : "Add entry");
  const exportLabel = t("exportCsv") || "Export CSV";
  const usdRates = await getUsdRates();

  const [entries, deletedEntries] = await withTiming("ledger.list_data", () =>
    Promise.all([
      prisma.ledgerEntry.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { entryDate: "desc" },
        select: {
          id: true,
          entryDate: true,
          type: true,
          category: true,
          description: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.ledgerEntry.findMany({
        where: { companyId, deletedAt: { not: null } },
        orderBy: { entryDate: "desc" },
        select: {
          id: true,
          entryDate: true,
          type: true,
          category: true,
          description: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      }),
    ])
  );

  const incomeTotal = entries
    .filter((entry) => entry.type === "INCOME")
    .reduce((sum, entry) => {
      const converted = convertWithUsdRates(
        Number(entry.amount),
        entry.currency,
        displayCurrency,
        usdRates
      );
      return sum + converted;
    }, 0);
  const expenseTotal = entries
    .filter((entry) => entry.type === "EXPENSE")
    .reduce((sum, entry) => {
      const converted = convertWithUsdRates(
        Number(entry.amount),
        entry.currency,
        displayCurrency,
        usdRates
      );
      return sum + converted;
    }, 0);
  const netTotal = incomeTotal - expenseTotal;

  return (
    <div className="page section-muted">
      <div className="page-header">
        <h1 className="page-title">{t("accounting")}</h1>
        <p className="muted">{t("ledgerSubtitle")}</p>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label">{t("incomeTotal")} ({displayCurrency})</div>
          <div className="kpi-value">{formatCurrency(incomeTotal, displayCurrency, locale)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("expenseTotal")} ({displayCurrency})</div>
          <div className="kpi-value">{formatCurrency(expenseTotal, displayCurrency, locale)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("netTotal")} ({displayCurrency})</div>
          <div className="kpi-value">{formatCurrency(netTotal, displayCurrency, locale)}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t("addEntry")}</div>
        <form id="ledger-form" action={createEntry} className="form-grid">
          <select name="type" defaultValue="EXPENSE">
            <option value="INCOME">{t("income")}</option>
            <option value="EXPENSE">{t("expense")}</option>
          </select>
          <input name="amount" type="number" step="0.01" placeholder={t("amount")} required />
          <select name="currency" defaultValue={displayCurrency}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
          <input name="category" placeholder={t("category")} />
          <input name="description" placeholder={t("description")} />
          <input name="entryDate" type="date" placeholder={t("entryDate")} required />
        </form>
        <div className="form-actions actions-row">
          <button type="submit" form="ledger-form" className="form-primary">
            {addEntryLabel}
          </button>
          <Link className="form-secondary" href="/api/ledger/export">
            {exportLabel}
          </Link>
        </div>
      </div>

      <div className="view-switch">
        <Link className={`view-switch-item ${!showDeleted ? "active" : ""}`} href="/ledger">
          {t("activeItems")}
        </Link>
        <Link
          className={`view-switch-item view-switch-item-secondary ${showDeleted ? "active" : ""}`}
          href="/ledger?view=deleted"
        >
          {t("deletedItems")}
        </Link>
      </div>

      {!showDeleted && entries.length === 0 ? (
        <p className="muted">{t("noEntries")}</p>
      ) : !showDeleted ? (
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("entryDate")}</th>
              <th>{t("entryType")}</th>
              <th>{t("category")}</th>
              <th>{t("description")}</th>
              <th className="num">{t("amount")}</th>
              <th>{t("currency")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <div className="stack" style={{ gap: 4 }}>
                    <span>{new Intl.DateTimeFormat(locale).format(entry.entryDate)}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {t("createdAt")}: {new Intl.DateTimeFormat(locale).format(entry.createdAt)}
                    </span>
                  </div>
                </td>
                <td>
                  <span
                    className={`status-pill ${
                      entry.type === "INCOME" ? "status-safe" : "status-warning"
                    }`}
                  >
                    {entry.type}
                  </span>
                </td>
                <td>{entry.category ?? "-"}</td>
                <td>{entry.description ?? "-"}</td>
                <td className="num">
                  {formatCurrency(Number(entry.amount), entry.currency, locale)}
                </td>
                <td>{entry.currency}</td>
                <td>
                  <div className="actions-row">
                    <Link
                      className="ghost icon-action edit-action"
                      href={`/ledger/${entry.id}/edit`}
                      title={t("edit")}
                      aria-label={t("edit")}
                    >
                      {"\u270E"}
                    </Link>
                    <ConfirmDeleteForm
                      action={deleteEntry}
                      id={entry.id}
                      label={"\u{1F5D1}"}
                      className="ghost danger-ghost icon-action"
                      confirmText={t("confirmDelete")}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      ) : null}

      {showDeleted ? (
        deletedEntries.length > 0 ? (
        <>
          <h2 className="section-title">{t("deletedEntries")}</h2>
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("entryDate")}</th>
                <th>{t("entryType")}</th>
                <th>{t("category")}</th>
                <th>{t("description")}</th>
                <th className="num">{t("amount")}</th>
                <th>{t("currency")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {deletedEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <div className="stack" style={{ gap: 4 }}>
                      <span>{new Intl.DateTimeFormat(locale).format(entry.entryDate)}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {t("createdAt")}: {new Intl.DateTimeFormat(locale).format(entry.createdAt)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        entry.type === "INCOME" ? "status-safe" : "status-warning"
                      }`}
                    >
                      {entry.type}
                    </span>
                  </td>
                  <td>{entry.category ?? "-"}</td>
                  <td>{entry.description ?? "-"}</td>
                  <td className="num">
                    {formatCurrency(Number(entry.amount), entry.currency, locale)}
                  </td>
                  <td>{entry.currency}</td>
                  <td>
                    <div className="actions-row">
                      <form action={restoreEntry}>
                        <input type="hidden" name="id" value={entry.id} />
                        <button type="submit" className="ghost">
                          {t("restore")}
                        </button>
                      </form>
                      <ConfirmDeleteForm
                        action={deleteEntryForever}
                        id={entry.id}
                        label={"\u{1F5D1}"}
                        className="ghost danger-ghost icon-action"
                        confirmText={t("confirmDeleteForever")}
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
          <p className="muted">{t("deletedEntries")}: 0</p>
        )
      ) : null}
    </div>
  );
  });
}
