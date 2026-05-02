import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "@/lib/i18n";
import { requireCompanyId } from "@/lib/session";
import { Currency } from "@prisma/client";
import { convertWithUsdRates, getUsdRates } from "@/lib/currency";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

async function updateCost(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const amountValue = Number(formData.get("amount") ?? 0);
  const currency = String(formData.get("currency") ?? "USD") as Currency;
  const frequency = String(formData.get("frequency") ?? "MONTHLY").toUpperCase();
  if (!id || !name || !Number.isFinite(amountValue) || amountValue <= 0) {
    redirect(`/costs/${id}/edit?error=invalid_cost`);
  }

  const usdRates = await getUsdRates();
  const amountUsd = convertWithUsdRates(amountValue, currency, "USD", usdRates);

  await prisma.cost.updateMany({
    where: { id, companyId, deletedAt: null },
    data: {
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
  redirect("/costs");
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const companyId = await requireCompanyId();
  const { id } = await params;
  const { error } = searchParams ? await searchParams : {};
  const cost = await prisma.cost.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!cost) {
    redirect("/costs");
  }

  const settings = await prisma.settings.findFirst({ where: { companyId } });
  const { t, language } = getTranslations(settings?.language);
  const errorMessage = error === "invalid_cost" ? t("errorInvalidCost") : null;
  const saveLabel = t("save") || (language === "NO" ? "Lagre" : "Save");

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 className="page-title">{t("editCost")}</h1>
        <Link className="nav-link subtle" href="/costs">
          {t("back")}
        </Link>
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <form action={updateCost} className="stack" style={{ maxWidth: 520 }}>
        <input type="hidden" name="id" value={cost.id} />
        <label className="stack">
          <span>{t("name")}</span>
          <input name="name" defaultValue={cost.name} required />
        </label>
        <label className="stack">
          <span>{t("supplier")}</span>
          <input name="supplier" defaultValue={cost.supplier ?? ""} />
        </label>
        <label className="stack">
          <span>{t("category")}</span>
          <input name="category" defaultValue={cost.category ?? ""} />
        </label>
        <label className="stack">
          <span>{t("amount")}</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={Number(cost.amount)}
            required
          />
        </label>
        <label className="stack">
          <span>{t("currency")}</span>
          <select name="currency" defaultValue={cost.currency === "NOK" ? "USD" : cost.currency}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="stack">
          <span>{t("frequency")}</span>
          <select name="frequency" defaultValue={cost.frequency}>
            <option value="MONTHLY">MONTHLY</option>
            <option value="YEARLY">YEARLY</option>
            <option value="WEEKLY">WEEKLY</option>
          </select>
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
