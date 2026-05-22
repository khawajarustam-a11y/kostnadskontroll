import ContractQuickForm from "@/components/ContractQuickForm";
import { getSettingsCached } from "@/lib/cached-data";
import { getComputedContractStatus } from "@/lib/contracts";
import { getTranslations } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { clampAlertDays, parseCurrency, parseOptionalDate, parsePositiveAmount } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

async function createContract(formData: FormData) {
  "use server";
  const companyId = await requireCompanyId();
  const name = String(formData.get("name") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim();
  const startDateValue = String(formData.get("startDate") ?? "").trim();
  const endDateValue = String(formData.get("endDate") ?? "").trim();
  const renewalDateValue = String(formData.get("renewalDate") ?? "").trim();
  const cancelByDateValue = String(formData.get("cancelByDate") ?? "").trim();
  const pricePerMonth = parsePositiveAmount(formData.get("pricePerMonth"));
  const currency = parseCurrency(formData.get("currency"));
  const alertDays = clampAlertDays(formData.get("alertDays"), 30);
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) {
    redirect("/contracts/new?error=invalid_contract");
  }

  const startDate = parseOptionalDate(startDateValue);
  const endDate = parseOptionalDate(endDateValue);
  const renewalDate = parseOptionalDate(renewalDateValue);
  const cancelByDate = parseOptionalDate(cancelByDateValue);

  if (startDate === "invalid" || endDate === "invalid" || renewalDate === "invalid" || cancelByDate === "invalid") {
    redirect("/contracts/new?error=invalid_contract");
  }
  if (startDate && endDate && endDate < startDate) {
    redirect("/contracts/new?error=invalid_date_range");
  }

  await prisma.contract.create({
    data: {
      companyId,
      name,
      supplier: supplier || null,
      status: getComputedContractStatus(endDate, cancelByDate, new Date()),
      startDate,
      endDate,
      renewalDate,
      cancelByDate,
      pricePerMonth,
      currency,
      alertDays,
      notes: notes || null,
    },
  });

  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  redirect("/contracts");
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const companyId = await requireCompanyId();
  const settings = await getSettingsCached(companyId);
  const { t } = getTranslations(settings?.language);
  const { error } = searchParams ? await searchParams : {};
  const errorMessage =
    error === "invalid_date_range"
      ? t("errorInvalidDateRange")
      : error === "invalid_contract"
        ? t("errorInvalidContract")
        : null;

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">{t("contracts")}</p>
        <h1 className="page-title">{t("addContract")}</h1>
        <p className="muted">{t("quickAddSubtitle")}</p>
        <div className="page-actions">
          <Link className="form-secondary" href="/contracts">
            {t("back")}
          </Link>
        </div>
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <ContractQuickForm
        action={createContract}
        defaultAlertDays={settings?.defaultAlertDays ?? 30}
        labels={{
          title: t("quickAddContract"),
          subtitle: t("quickAddSubtitle"),
          template: t("contractTemplate"),
          monthly: t("templateMonthlySaaS"),
          annual: t("templateAnnualSaaS"),
          domain: t("templateDomainHosting"),
          insurance: t("templateInsurance"),
          custom: t("templateCustom"),
          name: t("name"),
          supplier: t("supplier"),
          startDate: t("startDate"),
          endDate: t("endDate"),
          renewalDate: t("renewalDate"),
          cancelByDate: t("cancelByDate"),
          contractDates: t("contractDates"),
          alertDays: t("alertDays"),
          notes: t("notes"),
          submit: t("addContract"),
          quickTip: t("quickAddTip"),
        }}
      />
    </div>
  );
}
