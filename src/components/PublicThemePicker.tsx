"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

const STORAGE_KEY = "theme-mode";
const OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function getResolvedTheme(mode: Mode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

function applyTheme(mode: Mode) {
  document.documentElement.setAttribute("data-theme", getResolvedTheme(mode));
}

export default function PublicThemePicker() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initialMode: Mode =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(initialMode);
    applyTheme(initialMode);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (mode === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const chooseMode = (nextMode: Mode) => {
    setMode(nextMode);
    localStorage.setItem(STORAGE_KEY, nextMode);
    applyTheme(nextMode);
  };

  return (
    <div className="public-theme-picker" aria-label="Website theme">
      <p>Website theme</p>
      <div className="public-theme-options">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              option.value === mode
                ? "public-theme-option public-theme-option-active"
                : "public-theme-option"
            }
            aria-pressed={option.value === mode}
            onClick={() => chooseMode(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
