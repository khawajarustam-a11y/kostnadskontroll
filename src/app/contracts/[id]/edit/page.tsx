import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "@/lib/i18n";
import { requireCompanyId } from "@/lib/session";
import { ContractStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

async function updateContract(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim();
  const status = String(formData.get("status") ?? "ACTIVE") as ContractStatus;
  const startDateValue = String(formData.get("startDate") ?? "").trim();
  const endDateValue = String(formData.get("endDate") ?? "").trim();
  const renewalDateValue = String(formData.get("renewalDate") ?? "").trim();
  const cancelByDateValue = String(formData.get("cancelByDate") ?? "").trim();
  if (!id || !name) {
    redirect(`/contracts/${id}/edit?error=invalid_contract`);
  }

  const startDate = startDateValue ? new Date(startDateValue) : null;
  const endDate = endDateValue ? new Date(endDateValue) : null;
  const renewalDate = renewalDateValue ? new Date(renewalDateValue) : null;
  const cancelByDate = cancelByDateValue ? new Date(cancelByDateValue) : null;
  if (startDate && Number.isNaN(startDate.getTime())) {
    redirect(`/contracts/${id}/edit?error=invalid_contract`);
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    redirect(`/contracts/${id}/edit?error=invalid_contract`);
  }
  if (renewalDate && Number.isNaN(renewalDate.getTime())) {
    redirect(`/contracts/${id}/edit?error=invalid_contract`);
  }
  if (cancelByDate && Number.isNaN(cancelByDate.getTime())) {
    redirect(`/contracts/${id}/edit?error=invalid_contract`);
  }
  if (startDate && endDate && endDate < startDate) {
    redirect(`/contracts/${id}/edit?error=invalid_date_range`);
  }

  await prisma.contract.updateMany({
    where: { id, companyId, deletedAt: null },
    data: {
      name,
      supplier: supplier || null,
      status,
      startDate,
      endDate,
      renewalDate,
      cancelByDate,
    },
  });

  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  redirect("/contracts");
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
  const contract = await prisma.contract.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!contract) {
    redirect("/contracts");
  }

  const settings = await prisma.settings.findFirst({ where: { companyId } });
  const { t, language } = getTranslations(settings?.language);
  const errorMessage = error === "invalid_date_range"
    ? t("errorInvalidDateRange")
    : error === "invalid_contract"
      ? t("errorInvalidContract")
      : null;
  const saveLabel = t("save") || (language === "NO" ? "Lagre" : "Save");

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 className="page-title">{t("editContract")}</h1>
        <Link className="nav-link subtle" href="/contracts">
          {t("back")}
        </Link>
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <form action={updateContract} className="stack" style={{ maxWidth: 520 }}>
        <input type="hidden" name="id" value={contract.id} />
        <label className="stack">
          <span>{t("name")}</span>
          <input name="name" defaultValue={contract.name} required />
        </label>
        <label className="stack">
          <span>{t("supplier")}</span>
          <input name="supplier" defaultValue={contract.supplier ?? ""} />
        </label>
        <label className="stack">
          <span>{t("status")}</span>
          <select name="status" defaultValue={contract.status}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="EXPIRING">EXPIRING</option>
            <option value="TERMINATED">TERMINATED</option>
          </select>
        </label>
        <label className="stack">
          <span>{t("startDate")}</span>
          <input
            name="startDate"
            type="date"
            defaultValue={
              contract.startDate
                ? contract.startDate.toISOString().slice(0, 10)
                : ""
            }
          />
        </label>
        <label className="stack">
          <span>{t("endDate")}</span>
          <input
            name="endDate"
            type="date"
            defaultValue={
              contract.endDate
                ? contract.endDate.toISOString().slice(0, 10)
                : ""
            }
          />
        </label>
        <label className="stack">
          <span>{t("renewalDate")}</span>
          <input
            name="renewalDate"
            type="date"
            defaultValue={
              contract.renewalDate
                ? contract.renewalDate.toISOString().slice(0, 10)
                : ""
            }
          />
        </label>
        <label className="stack">
          <span>{t("cancelByDate")}</span>
          <input
            name="cancelByDate"
            type="date"
            defaultValue={
              contract.cancelByDate
                ? contract.cancelByDate.toISOString().slice(0, 10)
                : ""
            }
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
