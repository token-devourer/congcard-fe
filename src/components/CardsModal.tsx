"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CardValue, Color, FlipSide } from "@congcard/shared";
import { LIGHT_COLORS, DARK_COLORS } from "@congcard/shared";
import { CardView } from "./CardView";
import { shouldIgnoreShortcut } from "@/lib/shortcuts";

interface CardsModalProps {
  open: boolean;
  onClose: () => void;
  modeId: string;
}

type CardFace = { color: Color | null; value: CardValue; side?: FlipSide };
type CardGroup = { label: string; cards: CardFace[] };

const STANDARD_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as CardValue[];
const STANDARD_ACTIONS = ["skip", "reverse", "draw2"] as CardValue[];
const FLIP_ACTIONS = ["skip", "reverse", "draw2", "flip"] as CardValue[];
const FLIP_DARK_ACTIONS = ["skip", "reverse", "draw5", "flip"] as CardValue[];

function generateStandard(): CardGroup[] {
  const groups: CardGroup[] = [];
  for (const color of LIGHT_COLORS) {
    const cards: CardFace[] = [
      ...STANDARD_NUMBERS.map((value) => ({ color, value })),
      ...STANDARD_ACTIONS.map((value) => ({ color, value }))
    ];
    groups.push({ label: `color-${color}`, cards });
  }
  groups.push({
    label: "wild",
    cards: [
      { color: null, value: "wild" },
      { color: null, value: "wild4" }
    ]
  });
  return groups;
}

function generateFlip(): CardGroup[] {
  const groups: CardGroup[] = [];
  for (const color of LIGHT_COLORS) {
    const cards: CardFace[] = [
      ...STANDARD_NUMBERS.map((value) => ({ color, value, side: "light" as FlipSide })),
      ...FLIP_ACTIONS.map((value) => ({ color, value, side: "light" as FlipSide }))
    ];
    groups.push({ label: `flip-light-${color}`, cards });
  }
  groups.push({
    label: "flip-light-wild",
    cards: [
      { color: null, value: "wild", side: "light" },
      { color: null, value: "wild3", side: "light" }
    ]
  });
  for (const color of DARK_COLORS) {
    const cards: CardFace[] = [
      ...STANDARD_NUMBERS.map((value) => ({ color, value, side: "dark" as FlipSide })),
      ...FLIP_DARK_ACTIONS.map((value) => ({ color, value, side: "dark" as FlipSide }))
    ];
    groups.push({ label: `flip-dark-${color}`, cards });
  }
  groups.push({
    label: "flip-dark-wild",
    cards: [
      { color: null, value: "wild", side: "dark" },
      { color: null, value: "wildColor", side: "dark" }
    ]
  });
  return groups;
}

function generateCards(modeId: string): CardGroup[] {
  if (modeId === "flip") return generateFlip();
  return generateStandard();
}

function groupLabel(label: string, t: (key: string) => string): string {
  if (label === "flip-light-wild") return `${t("lightSide")} — ${t("wild")}`;
  if (label === "flip-dark-wild") return `${t("darkSide")} — ${t("wild")}`;
  if (label.startsWith("flip-light-")) {
    const color = label.replace("flip-light-", "");
    return `${t("lightSide")} — ${t(`color.${color}`)}`;
  }
  if (label.startsWith("flip-dark-")) {
    const color = label.replace("flip-dark-", "");
    return `${t("darkSide")} — ${t(`color.${color}`)}`;
  }
  if (label.startsWith("color-")) {
    return t(`color.${label.replace("color-", "")}`);
  }
  return t(label);
}

export function CardsModal({ open, onClose, modeId }: CardsModalProps) {
  const t = useTranslations("cardsModal");

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !shouldIgnoreShortcut(event)) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const groups = generateCards(modeId);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="cards-overlay"
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
            className="mobile-modal modal-medium panel no-scrollbar relative flex max-h-[90dvh] flex-col gap-5 p-5 shadow-[var(--shadow-pop)] md:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">{t("title")}</h2>
              <button
                type="button"
                className="button dim !min-h-8 !px-3 text-sm"
                onClick={onClose}
              >
                {t("close")}
              </button>
            </div>

            <div className="flex flex-col gap-6 overflow-y-auto pr-1">
              {groups.map((group) => (
                <section key={group.label}>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
                    {groupLabel(group.label, t)}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {group.cards.map((face, index) => (
                      <CardView
                        key={`${group.label}-${face.color ?? "wild"}-${String(face.value)}-${index}`}
                        card={face}
                        small
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
