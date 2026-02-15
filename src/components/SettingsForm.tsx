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
  labels: {
    language: string;
    displayCurrency: string;
    baseCurrency: string;
    alertDays: string;
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
  labels,
}: SettingsFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const submitNow = () => formRef.current?.requestSubmit();

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
            <option value="NO">NO</option>
            <option value="EN">EN</option>
          </select>
        </label>
        <label className="stack">
          <span>{labels.displayCurrency}</span>
          <select
            name="displayCurrency"
            defaultValue={displayCurrency}
            onChange={submitNow}
          >
            <option value="USD">USD</option>
            <option value="NOK">NOK</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="stack">
          <span>{labels.baseCurrency}</span>
          <select
            name="baseCurrency"
            defaultValue={baseCurrency}
            onChange={submitNow}
          >
            <option value="USD">USD</option>
            <option value="NOK">NOK</option>
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

