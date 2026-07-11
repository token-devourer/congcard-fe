"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CardValue, Color, FlipSide, RoomSettings } from "@congcard/shared";
import { CHAOS_SPECIAL_VALUES, getChaosSpecialSpawnMode, getChaosSpecialSpawnPercent, LIGHT_COLORS, DARK_COLORS } from "@congcard/shared";
import { CardView } from "./CardView";
import { playSound, type SoundName } from "@/lib/sound";
import { shouldIgnoreShortcut } from "@/lib/shortcuts";

interface CardsModalProps {
  open: boolean;
  onClose: () => void;
  modeId: string;
  settings?: RoomSettings;
}

type CardFace = { color: Color | null; value: CardValue; side?: FlipSide; count?: number };
type CardGroup = { label: string; cards: CardFace[] };

const STANDARD_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as CardValue[];
const STANDARD_ACTIONS = ["skip", "reverse", "draw2"] as CardValue[];
const FLIP_ACTIONS = ["skip", "reverse", "draw2", "flip"] as CardValue[];
const FLIP_DARK_ACTIONS = ["skip", "reverse", "draw5", "flip"] as CardValue[];

const MEME_TO_SOUND: Record<string, SoundName> = {
  flashbang: "memeFlashbang",
  throwup: "memeThrowup",
  steal: "memeSteal",
  favor: "memeFavor",
  peek: "memePeek",
  vote: "memeVote",
  chaosCard: "memeChaos",
  timeskip: "memeTimeskip",
  mirror: "memeMirror",
  pandemic: "memePandemic",
  magnet: "memeMagnet",
  jackpot: "memeJackpot",
  roulette: "memeRoulette",
  nuke: "memeNuke",
  mime: "memeMime"
};

function soundForCardFace(face: CardFace): SoundName {
  const memeSound = MEME_TO_SOUND[String(face.value)];
  if (memeSound) return memeSound;
  switch (face.value) {
    case "skip": return "skip";
    case "reverse": return "reverse";
    case "draw1":
    case "draw2":
    case "draw5": return "penalty";
    case "flip": return face.side === "dark" ? "flipDark" : "flipLight";
    case "wild":
    case "wild2":
    case "wild3":
    case "wild4":
    case "wildColor": return "wild";
    default: return "uiClick";
  }
}

const CARD_TOOLTIP_KEYS: Partial<Record<CardValue, string>> = {
  skip: "tooltip.skip",
  reverse: "tooltip.reverse",
  draw1: "tooltip.draw1",
  draw2: "tooltip.draw2",
  draw5: "tooltip.draw5",
  flip: "tooltip.flip",
  wild: "tooltip.wild",
  wild2: "tooltip.wild2",
  wild3: "tooltip.wild3",
  wild4: "tooltip.wild4",
  wildColor: "tooltip.wildColor",
  flashbang: "tooltip.flashbang",
  throwup: "tooltip.throwup",
  steal: "tooltip.steal",
  favor: "tooltip.favor",
  peek: "tooltip.peek",
  vote: "tooltip.vote",
  chaosCard: "tooltip.chaosCard",
  timeskip: "tooltip.timeskip",
  mirror: "tooltip.mirror",
  pandemic: "tooltip.pandemic",
  magnet: "tooltip.magnet",
  jackpot: "tooltip.jackpot",
  roulette: "tooltip.roulette",
  nuke: "tooltip.nuke",
  mime: "tooltip.mime"
};

const CARD_TOAST_LABELS: Partial<Record<CardValue, string>> = {
  skip: "SKIP",
  reverse: "REVERSE",
  draw1: "+1",
  draw2: "+2",
  draw5: "+5",
  flip: "FLIP",
  wild: "WILD",
  wild2: "+2",
  wild3: "+3",
  wild4: "+4",
  wildColor: "COLOR",
  flashbang: "FLASH",
  throwup: "THROW",
  steal: "STEAL",
  favor: "FAVOR",
  peek: "PEEK",
  vote: "VOTE",
  chaosCard: "CHAOS",
  timeskip: "SKIP↑",
  mirror: "MIRROR",
  pandemic: "COVID",
  magnet: "MAGNET",
  jackpot: "JACKPOT",
  roulette: "ROULETTE",
  nuke: "NUKE",
  mime: "MIME"
};

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

const CHAOS_ACTIONS = ["skip", "reverse", "draw1", "throwup"] as CardValue[];
const CHAOS_SPECIALS = CHAOS_SPECIAL_VALUES.filter((value) => value !== "throwup") as CardValue[];

function chaosSpecialCounts(settings?: RoomSettings): Record<string, number> {
  const deckBoxes = settings?.deckBoxes ?? 1;
  if (getChaosSpecialSpawnMode(settings?.modeOptions) === "fixed") {
    return Object.fromEntries(CHAOS_SPECIAL_VALUES.map((value) => [value, value === "throwup" ? deckBoxes * 8 : deckBoxes * 2]));
  }

  const total = deckBoxes * 128;
  const target = Math.round(total * getChaosSpecialSpawnPercent(settings?.modeOptions) / 100);
  const base = Math.floor(target / CHAOS_SPECIAL_VALUES.length);
  const remainder = target % CHAOS_SPECIAL_VALUES.length;
  return Object.fromEntries(CHAOS_SPECIAL_VALUES.map((value, index) => [value, base + (index < remainder ? 1 : 0)]));
}

function generateChaos(settings?: RoomSettings): CardGroup[] {
  const specialCounts = chaosSpecialCounts(settings);
  const throwupTotal = specialCounts.throwup ?? 0;
  const throwupBase = Math.floor(throwupTotal / LIGHT_COLORS.length);
  const throwupRemainder = throwupTotal % LIGHT_COLORS.length;
  const groups: CardGroup[] = [];
  for (const [colorIndex, color] of LIGHT_COLORS.entries()) {
    const cards: CardFace[] = [
      ...STANDARD_NUMBERS.map((value) => ({ color, value })),
      ...CHAOS_ACTIONS.map((value) => ({
        color,
        value,
        ...(value === "throwup" ? { count: throwupBase + (colorIndex < throwupRemainder ? 1 : 0) } : {})
      }))
    ];
    groups.push({ label: `color-${color}`, cards });
  }
  groups.push({
    label: "wild",
    cards: [
      { color: null, value: "wild" },
      { color: null, value: "wild2" }
    ]
  });
  groups.push({
    label: "special",
    cards: CHAOS_SPECIALS.map((value) => ({ color: null, value, count: specialCounts[value] ?? 0 }))
  });
  return groups;
}

function generateCards(modeId: string, settings?: RoomSettings): CardGroup[] {
  if (modeId === "flip") return generateFlip();
  if (modeId === "chaos") return generateChaos(settings);
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
  if (label === "special") return t("special");
  return t(label);
}

export function CardsModal({ open, onClose, modeId, settings }: CardsModalProps) {
  const t = useTranslations("cardsModal");
  const [previewedKey, setPreviewedKey] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hoveredCard, setHoveredCard] = useState<{ rect: DOMRect; text: string } | null>(null);

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

  const handleCardClick = useCallback((face: CardFace, key: string) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreviewedKey(key);
    playSound(soundForCardFace(face));
    previewTimer.current = setTimeout(() => setPreviewedKey(null), 600);
  }, []);

  const groups = generateCards(modeId, settings);

  return (
    <>
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
                  <div className="flex flex-wrap gap-2 pb-16 px-2">
                    {group.cards.map((face, index) => {
                      const key = `${group.label}-${face.color ?? "wild"}-${String(face.value)}-${index}`;
                      const isPreview = previewedKey === key;
                      const tooltipKey = CARD_TOOLTIP_KEYS[face.value];
                      return (
                        <div
                          key={key}
                          className="card-preview-wrapper"
                          onMouseEnter={(e) => {
                            if (!tooltipKey) return;
                            setHoveredCard({ rect: e.currentTarget.getBoundingClientRect(), text: t(tooltipKey) });
                          }}
                          onMouseLeave={() => setHoveredCard(null)}
                        >
                          <CardView
                            card={face}
                            onClick={() => handleCardClick(face, key)}
                          />
                          {face.count !== undefined ? (
                            <span className="absolute -right-1 -top-2 z-20 rounded-full border border-[var(--gold)] bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-black text-[var(--gold)] shadow-lg">
                              x{face.count}
                            </span>
                          ) : null}
                          {isPreview ? (
                            <span className="card-preview-toast">
                              {CARD_TOAST_LABELS[face.value] ?? String(face.value)}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>
    {hoveredCard ? createPortal(
      <span
        className="card-tooltip"
        style={{
          position: "fixed",
          top: hoveredCard.rect.bottom + 6,
          left: hoveredCard.rect.left + hoveredCard.rect.width / 2,
          transform: "translateX(-50%)",
          zIndex: 100
        }}
      >
        {hoveredCard.text}
      </span>,
      document.body
    ) : null}
  </>);
}
