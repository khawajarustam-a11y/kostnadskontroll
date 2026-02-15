import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "@/lib/i18n";
import { requireCompanyId } from "@/lib/session";
import { Currency, LedgerEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

async function updateEntry(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  const type = String(formData.get("type") ?? "EXPENSE") as LedgerEntryType;
  const amountValue = String(formData.get("amount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "NOK") as Currency;
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const entryDateValue = String(formData.get("entryDate") ?? "").trim();

  const amount = Number(amountValue.replace(",", "."));
  if (!id || !Number.isFinite(amount) || amount <= 0) {
    redirect(`/ledger/${id}/edit`);
  }

  const entryDate = entryDateValue ? new Date(entryDateValue) : null;
  if (!entryDate || Number.isNaN(entryDate.getTime())) {
    redirect(`/ledger/${id}/edit`);
  }

  await prisma.ledgerEntry.updateMany({
    where: { id, companyId, deletedAt: null },
    data: {
      type,
      amount,
      currency,
      category: category || null,
      description: description || null,
      entryDate,
    },
  });

  revalidatePath("/ledger");
  redirect("/ledger");
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const companyId = await requireCompanyId();
  const { id } = await params;
  const entry = await prisma.ledgerEntry.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!entry) {
    redirect("/ledger");
  }

  const settings = await prisma.settings.findFirst({ where: { companyId } });
  const { t, language } = getTranslations(settings?.language);
  const saveLabel = t("save") || (language === "NO" ? "Lagre" : "Save");

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 className="page-title">{t("edit")}</h1>
        <Link className="nav-link subtle" href="/ledger">
          {t("back")}
        </Link>
      </div>
      <form action={updateEntry} className="stack" style={{ maxWidth: 520 }}>
        <input type="hidden" name="id" value={entry.id} />
        <label className="stack">
          <span>{t("entryType")}</span>
          <select name="type" defaultValue={entry.type}>
            <option value="INCOME">{t("income")}</option>
            <option value="EXPENSE">{t("expense")}</option>
          </select>
        </label>
        <label className="stack">
          <span>{t("amount")}</span>
          <input name="amount" type="number" step="0.01" defaultValue={Number(entry.amount)} required />
        </label>
        <label className="stack">
          <span>{t("currency")}</span>
          <select name="currency" defaultValue={entry.currency}>
            <option value="NOK">NOK</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="stack">
          <span>{t("category")}</span>
          <input name="category" defaultValue={entry.category ?? ""} />
        </label>
        <label className="stack">
          <span>{t("description")}</span>
          <input name="description" defaultValue={entry.description ?? ""} />
        </label>
        <label className="stack">
          <span>{t("entryDate")}</span>
          <input
            name="entryDate"
            type="date"
            defaultValue={entry.entryDate.toISOString().slice(0, 10)}
            required
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="form-primary" aria-label={saveLabel}>
            {saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
