import { prisma } from "@/lib/prisma";
import { getTranslations } from "@/lib/i18n";
import { isAuthRequired } from "@/lib/auth";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function Page() {
  if (isAuthRequired()) {
    redirect("/login");
  }
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
  });
  const settings = await prisma.settings.findFirst({
    where: { companyId: companies[0]?.id ?? "" },
  });
  const { t } = getTranslations(settings?.language);

  return (
    <div className="page">
      <h1 className="page-title">{t("selectCompany")}</h1>
      {companies.length === 0 ? (
        <p className="muted">{t("noCompanies")}</p>
      ) : (
        <form
          action="/api/select-company"
          method="post"
          className="stack"
          style={{ maxWidth: 360 }}
        >
          <label className="stack">
            <span>{t("chooseCompany")}</span>
            <select
              name="companyId"
              defaultValue={companies[0].id}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">{t("continue")}</button>
        </form>
      )}
    </div>
  );
}


