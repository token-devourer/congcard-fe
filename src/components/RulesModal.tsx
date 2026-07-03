"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { RoomSettings } from "@congcard/shared";
import { shouldIgnoreShortcut } from "@/lib/shortcuts";

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
  settings?: RoomSettings;
}

// Rules live as an in-room overlay, not a separate route: closing it returns the
// player to whatever room state they were in (lobby or board) instead of routing
// away to the landing page.
export function RulesModal({ open, onClose, settings }: RulesModalProps) {
  const t = useTranslations("rules");
  const deckBoxes = settings?.deckBoxes ?? 1;
  const lastStand = settings?.scoreTarget === "lastStand";
  const flipMode = settings?.modeId === "flip";
  const chaosMode = settings?.modeId === "chaos";
  const deckBoxesRuleKey = chaosMode ? "deckBoxesChaosRule" : flipMode ? "deckBoxesFlipRule" : "deckBoxesRule";
  const wild4RuleKey = settings?.stackingEnabled
    ? "actionWild4Stacking"
    : settings?.challengeEnabled ?? true
      ? "actionWild4"
      : "actionWild4NoChallenge";

  useEffect(() => {
    if (!open || !(settings?.keyboardShortcutsEnabled ?? true)) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !shouldIgnoreShortcut(event)) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, settings?.keyboardShortcutsEnabled]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="rules-overlay"
          className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-4"
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
            className="mobile-modal modal-medium panel no-scrollbar relative flex flex-col gap-5 p-5 shadow-[var(--shadow-pop)] md:p-7"
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
                aria-keyshortcuts="Escape"
              >
                ✕ {t("back")}
              </button>
            </div>

            <section className="space-y-2">
              <h2 className="display text-xl font-bold">{t("goalTitle")}</h2>
              <p className="text-[var(--muted)]">{lastStand ? t("goalLastStandBody") : t("goalBody")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="display text-xl font-bold">{t("turnsTitle")}</h2>
              <p className="text-[var(--muted)]">{t("turnsBody")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="display text-xl font-bold">{t("settingsTitle")}</h2>
              <ul className="list-disc space-y-2 pl-5 text-[var(--muted)]">
                <li>{t(flipMode ? "modeFlipRule" : "modeRule")}</li>
                <li>{lastStand ? t("lastStandOn") : t("scoreRule")}</li>
                <li>{settings?.jumpInEnabled ? t("jumpInOn") : t("jumpInOff")}</li>
                <li>{settings?.stackingEnabled ? t("stackingOn") : t("stackingOff")}</li>
                <li>{settings?.challengeEnabled ?? true ? t(flipMode ? "challengeFlipOn" : "challengeOn") : t(flipMode ? "challengeFlipOff" : "challengeOff")}</li>
                <li>{settings?.callEnabled ?? true ? t("callOn") : t("callOff")}</li>
                <li>{settings?.batchEnabled ? t("batchOn") : t("batchOff")}</li>
                <li>{settings?.keyboardShortcutsEnabled ?? true ? t("shortcutsOn") : t("shortcutsOff")}</li>
                <li>{t(`absentPlayer.${settings?.absentPlayerAction ?? "draw"}`)}</li>
                {settings?.absentPlayerAction === "autoplay" ? (
                  <li>{settings.autoPlayCallOne ? t("autoPlayOneOn") : t("autoPlayOneOff")}</li>
                ) : null}
                <li>{t(deckBoxesRuleKey, { count: deckBoxes })}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="display text-xl font-bold">{t("actionsTitle")}</h2>
              <ul className="list-disc space-y-2 pl-5 text-[var(--muted)]">
                <li>{t("actionSkip")}</li>
                <li>{t("actionReverse")}</li>
                <li>{t(flipMode ? "actionFlipDraws" : "actionDraw2")}</li>
                {flipMode ? <li>{t("actionFlip")}</li> : null}
                {flipMode ? <li>{t("actionWildColor")}</li> : null}
                <li>{t("actionWild")}</li>
                {!flipMode ? <li>{t(wild4RuleKey)}</li> : null}
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="display text-xl font-bold">{t("oneTitle")}</h2>
              <p className="text-[var(--muted)]">{settings?.callEnabled ?? true ? t("oneBody") : t("oneBodyDisabled")}</p>
            </section>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
