"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { safeGet, safeSet } from "@/lib/storage";
import { NOTIFY_STORAGE_KEY } from "./TurnAlertLayer";

export function NotifyToggle() {
  const t = useTranslations();
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "Notification" in window;
    setSupported(ok);
    setEnabled(ok && safeGet(NOTIFY_STORAGE_KEY) === "1" && Notification.permission === "granted");
  }, []);

  async function toggle() {
    if (!supported) return;

    if (enabled) {
      setEnabled(false);
      safeSet(NOTIFY_STORAGE_KEY, "0");
      return;
    }

    // Only ask for permission on an explicit enable — never auto-prompt on load.
    let permission = Notification.permission;
    if (permission === "default") {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = "denied";
      }
    }

    const granted = permission === "granted";
    setEnabled(granted);
    safeSet(NOTIFY_STORAGE_KEY, granted ? "1" : "0");
  }

  if (!supported) {
    return null;
  }

  const label = enabled ? t("common.notifyOn") : t("common.notifyOff");

  return (
    <button
      type="button"
      className={`rounded-full border px-3 py-1 transition-colors ${
        enabled ? "border-[var(--gold)] text-[var(--gold)]" : "border-[var(--line)] text-[var(--text)] hover:border-[var(--gold)]"
      }`}
      onClick={toggle}
      aria-pressed={enabled}
      title={label}
    >
      <span aria-hidden="true">{enabled ? "🔔" : "🔕"}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
