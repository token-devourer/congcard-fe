"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

const OPTIONS = [
  { value: "id", key: "id" },
  { value: "en", key: "en" }
] as const;

export function LanguageToggle() {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectLocale(next: string) {
    if (next === locale || isPending) {
      return;
    }
    // Locale is cookie-driven (see i18n/request.ts). Write the cookie, then
    // refresh so the server re-renders with the new messages.
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="flex overflow-hidden rounded-full border border-[var(--line)] text-xs font-black"
      role="group"
      aria-label={t("label")}
    >
      {OPTIONS.map((option) => {
        const active = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={isPending}
            aria-pressed={active}
            onClick={() => selectLocale(option.value)}
            className={`px-3 py-1.5 uppercase transition-colors ${
              active ? "bg-[var(--gold)] text-black" : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t(option.key)}
          </button>
        );
      })}
    </div>
  );
}
