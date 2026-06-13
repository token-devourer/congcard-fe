"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

// Rules live as an in-room overlay, not a separate route: closing it returns the
// player to whatever room state they were in (lobby or board) instead of routing
// away to the landing page.
export function RulesModal({ open, onClose }: RulesModalProps) {
  const t = useTranslations("rules");

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="rules-overlay"
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.article
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="panel relative flex max-h-[88vh] w-full max-w-2xl flex-col gap-5 overflow-y-auto p-5 shadow-[var(--shadow-pop)] md:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="display text-sm font-black uppercase tracking-[0.18em] text-[var(--gold)]">{t("tagline")}</p>
                <h1 className="display mt-2 text-2xl font-black md:text-3xl">{t("title")}</h1>
              </div>
              <button
                type="button"
                className="button secondary !min-h-9 !px-4 text-sm"
                onClick={onClose}
                aria-label={t("back")}
              >
                ✕ {t("back")}
              </button>
            </div>

            <section className="space-y-2">
              <h2 className="display text-xl font-bold">{t("goalTitle")}</h2>
              <p className="text-[var(--muted)]">{t("goalBody")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="display text-xl font-bold">{t("turnsTitle")}</h2>
              <p className="text-[var(--muted)]">{t("turnsBody")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="display text-xl font-bold">{t("actionsTitle")}</h2>
              <ul className="list-disc space-y-2 pl-5 text-[var(--muted)]">
                <li>{t("actionSkip")}</li>
                <li>{t("actionReverse")}</li>
                <li>{t("actionDraw2")}</li>
                <li>{t("actionWild")}</li>
                <li>{t("actionWild4")}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="display text-xl font-bold">{t("oneTitle")}</h2>
              <p className="text-[var(--muted)]">{t("oneBody")}</p>
            </section>

            <hr className="border-white/10" />

            <header className="space-y-1">
              <h2 className="display text-2xl font-black text-[var(--gold)]">{t("advTitle")}</h2>
              <p className="text-sm text-[var(--muted)]">{t("advIntro")}</p>
            </header>

            <section className="space-y-2">
              <h3 className="display text-xl font-bold">{t("challengeTitle")}</h3>
              <p className="text-[var(--muted)]">{t("challengeBody")}</p>
            </section>

            <section className="space-y-2">
              <h3 className="display text-xl font-bold">{t("drawTitle")}</h3>
              <p className="text-[var(--muted)]">{t("drawBody")}</p>
            </section>

            <section className="space-y-2">
              <h3 className="display text-xl font-bold">{t("timerTitle")}</h3>
              <p className="text-[var(--muted)]">{t("timerBody")}</p>
            </section>

            <section className="space-y-2">
              <h3 className="display text-xl font-bold">{t("catchTitle")}</h3>
              <p className="text-[var(--muted)]">{t("catchBody")}</p>
            </section>

            <section className="space-y-2">
              <h3 className="display text-xl font-bold">{t("noStackTitle")}</h3>
              <p className="text-[var(--muted)]">{t("noStackBody")}</p>
            </section>

            <section className="space-y-2">
              <h3 className="display text-xl font-bold">{t("scoringTitle")}</h3>
              <p className="text-[var(--muted)]">{t("scoringBody")}</p>
            </section>

            <section className="space-y-2">
              <h3 className="display text-xl font-bold">{t("edgeTitle")}</h3>
              <p className="text-[var(--muted)]">{t("edgeBody")}</p>
            </section>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
