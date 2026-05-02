"use client";

import { Currency } from "@prisma/client";
import { useMemo, useState } from "react";

type TemplateKey = "monthly" | "annual" | "domain" | "insurance" | "custom";

type Labels = {
  title: string;
  subtitle: string;
  template: string;
  monthly: string;
  annual: string;
  domain: string;
  insurance: string;
  custom: string;
  name: string;
  supplier: string;
  pricePerMonth: string;
  currency: string;
  startDate: string;
  endDate: string;
  renewalDate: string;
  cancelByDate: string;
  contractDates: string;
  alertDays: string;
  notes: string;
  submit: string;
  quickTip: string;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  defaultCurrency: Currency;
  defaultAlertDays: number;
  labels: Labels;
};

function dateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function addYears(date: Date, years: number): Date {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

function templateDates(template: TemplateKey) {
  const today = new Date();
  if (template === "monthly") {
    const renewalDate = addMonths(today, 1);
    return {
      startDate: dateValue(today),
      endDate: "",
      renewalDate: dateValue(renewalDate),
      cancelByDate: dateValue(addDays(renewalDate, -3)),
    };
  }
  if (template === "annual") {
    const renewalDate = addYears(today, 1);
    return {
      startDate: dateValue(today),
      endDate: dateValue(renewalDate),
      renewalDate: dateValue(renewalDate),
      cancelByDate: dateValue(addDays(renewalDate, -30)),
    };
  }
  if (template === "domain") {
    const renewalDate = addYears(today, 1);
    return {
      startDate: dateValue(today),
      endDate: dateValue(renewalDate),
      renewalDate: dateValue(renewalDate),
      cancelByDate: dateValue(addDays(renewalDate, -14)),
    };
  }
  if (template === "insurance") {
    const renewalDate = addYears(today, 1);
    return {
      startDate: dateValue(today),
      endDate: dateValue(renewalDate),
      renewalDate: dateValue(renewalDate),
      cancelByDate: dateValue(addDays(renewalDate, -60)),
    };
  }
  return {
    startDate: dateValue(today),
    endDate: "",
    renewalDate: "",
    cancelByDate: "",
  };
}

export default function ContractQuickForm({
  action,
  defaultCurrency,
  defaultAlertDays,
  labels,
}: Props) {
  const [template, setTemplate] = useState<TemplateKey>("monthly");
  const dates = useMemo(() => templateDates(template), [template]);
  const visibleDefaultCurrency = defaultCurrency === "NOK" ? "USD" : defaultCurrency;

  return (
    <div className="panel quick-add-panel">
      <div className="panel-title">{labels.title}</div>
      <p className="muted quick-add-subtitle">{labels.subtitle}</p>
      <form id="contract-form" action={action} className="stack">
        <div className="form-section">
          <div className="form-section-title">{labels.template}</div>
          <div className="template-grid">
            <label className="template-option">
              <input
                type="radio"
                name="template"
                value="monthly"
                checked={template === "monthly"}
                onChange={() => setTemplate("monthly")}
              />
              <span>{labels.monthly}</span>
            </label>
            <label className="template-option">
              <input
                type="radio"
                name="template"
                value="annual"
                checked={template === "annual"}
                onChange={() => setTemplate("annual")}
              />
              <span>{labels.annual}</span>
            </label>
            <label className="template-option">
              <input
                type="radio"
                name="template"
                value="domain"
                checked={template === "domain"}
                onChange={() => setTemplate("domain")}
              />
              <span>{labels.domain}</span>
            </label>
            <label className="template-option">
              <input
                type="radio"
                name="template"
                value="insurance"
                checked={template === "insurance"}
                onChange={() => setTemplate("insurance")}
              />
              <span>{labels.insurance}</span>
            </label>
            <label className="template-option">
              <input
                type="radio"
                name="template"
                value="custom"
                checked={template === "custom"}
                onChange={() => setTemplate("custom")}
              />
              <span>{labels.custom}</span>
            </label>
          </div>
          <p className="muted quick-tip">{labels.quickTip}</p>
        </div>

        <div className="form-section">
          <div className="form-section-title">{labels.title}</div>
          <div className="quick-contract-grid">
            <label className="field-label">
              <span>{labels.name}</span>
              <input name="name" required />
            </label>
            <label className="field-label">
              <span>{labels.supplier}</span>
              <input name="supplier" />
            </label>
            <label className="field-label">
              <span>{labels.pricePerMonth}</span>
              <input
                name="pricePerMonth"
                type="number"
                min="0"
                step="0.01"
              />
            </label>
            <label className="field-label">
              <span>{labels.currency}</span>
              <select name="currency" defaultValue={visibleDefaultCurrency}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label className="field-label">
              <span>{labels.alertDays}</span>
              <input
                name="alertDays"
                type="number"
                min="1"
                max="365"
                defaultValue={defaultAlertDays}
              />
            </label>
            <label className="field-label field-label-wide">
              <span>{labels.notes}</span>
              <input name="notes" />
            </label>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">{labels.contractDates}</div>
          <div className="form-grid form-grid-4">
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted">{labels.startDate}</span>
              <input key={template + dates.startDate + "start"} name="startDate" type="date" defaultValue={dates.startDate} />
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted">{labels.endDate}</span>
              <input key={template + dates.endDate + "end"} name="endDate" type="date" defaultValue={dates.endDate} />
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted">{labels.renewalDate}</span>
              <input key={template + dates.renewalDate + "renewal"} name="renewalDate" type="date" defaultValue={dates.renewalDate} />
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted">{labels.cancelByDate}</span>
              <input key={template + dates.cancelByDate + "cancel"} name="cancelByDate" type="date" defaultValue={dates.cancelByDate} />
            </label>
          </div>
        </div>
      </form>
      <div className="form-actions">
        <button type="submit" form="contract-form" className="form-primary" aria-label={labels.submit}>
          {labels.submit}
        </button>
      </div>
    </div>
  );
}
