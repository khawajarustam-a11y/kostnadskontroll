"use client";

import { useRef } from "react";
import ThemeModeSelect from "@/components/ThemeModeSelect";
import { Currency } from "@prisma/client";
import { Language } from "@/lib/i18n";

type SettingsFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  language: Language;
  displayCurrency: Currency;
  baseCurrency: Currency;
  defaultAlertDays: number;
  timezone: string;
  labels: {
    language: string;
    displayCurrency: string;
    baseCurrency: string;
    alertDays: string;
    timezone: string;
    theme: string;
    save: string;
    system: string;
    light: string;
    dark: string;
  };
};

export default function SettingsForm({
  action,
  language,
  displayCurrency,
  baseCurrency,
  defaultAlertDays,
  timezone,
  labels,
}: SettingsFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const submitNow = () => formRef.current?.requestSubmit();
  const visibleDisplayCurrency = displayCurrency === "NOK" ? "USD" : displayCurrency;
  const visibleBaseCurrency = baseCurrency === "NOK" ? "USD" : baseCurrency;

  return (
    <form action={action} className="panel stack" ref={formRef}>
      <div className="settings-grid">
        <label className="stack">
          <span>{labels.language}</span>
          <select
            name="language"
            defaultValue={language}
            onChange={submitNow}
          >
            <option value="EN">EN</option>
          </select>
        </label>
        <label className="stack">
          <span>{labels.displayCurrency}</span>
          <select
            name="displayCurrency"
            defaultValue={visibleDisplayCurrency}
            onChange={submitNow}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="stack">
          <span>{labels.baseCurrency}</span>
          <select
            name="baseCurrency"
            defaultValue={visibleBaseCurrency}
            onChange={submitNow}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="stack">
          <span>{labels.alertDays}</span>
          <input
            name="defaultAlertDays"
            type="number"
            min="1"
            defaultValue={defaultAlertDays}
            onBlur={submitNow}
          />
        </label>
        <label className="stack">
          <span>{labels.timezone}</span>
          <select name="timezone" defaultValue={timezone} onChange={submitNow}>
            <option value="Europe/Oslo">Europe/Oslo</option>
            <option value="Europe/Stockholm">Europe/Stockholm</option>
            <option value="Europe/Copenhagen">Europe/Copenhagen</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="Asia/Karachi">Asia/Karachi</option>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
          </select>
        </label>
        <ThemeModeSelect
          label={labels.theme}
          systemLabel={labels.system}
          lightLabel={labels.light}
          darkLabel={labels.dark}
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="form-primary" aria-label={labels.save}>
          {labels.save}
        </button>
      </div>
    </form>
  );
}
