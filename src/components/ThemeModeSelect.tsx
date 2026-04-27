"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

const STORAGE_KEY = "theme-mode";

function getResolvedTheme(mode: Mode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

function applyTheme(mode: Mode) {
  const resolved = getResolvedTheme(mode);
  document.documentElement.setAttribute("data-theme", resolved);
}

export default function ThemeModeSelect({
  label,
  systemLabel,
  lightLabel,
  darkLabel,
}: {
  label: string;
  systemLabel: string;
  lightLabel: string;
  darkLabel: string;
}) {
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

  const onModeChange = (value: string) => {
    const nextMode: Mode =
      value === "light" || value === "dark" || value === "system"
        ? value
        : "system";
    setMode(nextMode);
    localStorage.setItem(STORAGE_KEY, nextMode);
    applyTheme(nextMode);
  };

  return (
    <label className="stack">
      <span>{label}</span>
      <select
        value={mode}
        onChange={(event) => onModeChange(event.target.value)}
      >
        <option value="system">{systemLabel}</option>
        <option value="light">{lightLabel}</option>
        <option value="dark">{darkLabel}</option>
      </select>
    </label>
  );
}
