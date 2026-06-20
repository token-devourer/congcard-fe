"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { Card, CardValue, Color, GameSnapshot } from "@congcard/shared";
import { batchCardGroups, batchValueText } from "@/lib/batch";
import { ColorPicker } from "./ColorPicker";
import { CardView } from "./CardView";

interface BatchSelectorProps {
  snapshot: GameSnapshot;
  actionLocked: boolean;
  shortcutCommand?: BatchShortcutCommand | null;
  onSelectionChange: (active: boolean) => void;
  onPlay: (cards: Card[], declaredColor?: Color) => void;
}

export interface BatchShortcutCommand {
  id: number;
  type: "toggle" | "close";
}

export function BatchSelector({ snapshot, actionLocked, shortcutCommand, onSelectionChange, onPlay }: BatchSelectorProps) {
  const t = useTranslations();
  const groups = useMemo(() => batchCardGroups(snapshot, actionLocked), [actionLocked, snapshot]);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<CardValue | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [choosingColor, setChoosingColor] = useState(false);
  const group = groups.find((item) => item.value === value) ?? null;
  const selectedCards = selectedIds
    .map((id) => group?.cards.find((card) => card.id === id))
    .filter((card): card is Card => Boolean(card));

  useEffect(() => {
    if (groups.length === 0 || (value !== null && !groups.some((item) => item.value === value))) {
      setOpen(false);
      setValue(null);
      setSelectedIds([]);
      setChoosingColor(false);
    }
  }, [groups, value]);

  useEffect(() => {
    onSelectionChange(open || choosingColor);
    return () => onSelectionChange(false);
  }, [choosingColor, onSelectionChange, open]);

  function close() {
    setOpen(false);
    setValue(null);
    setSelectedIds([]);
    setChoosingColor(false);
  }

  useEffect(() => {
    if (!shortcutCommand) {
      return;
    }

    if (shortcutCommand.type === "close" || open || choosingColor) {
      close();
      return;
    }

    if (groups.length > 0) {
      setOpen(true);
    }
  }, [shortcutCommand]);

  function chooseGroup(nextValue: CardValue) {
    setValue(nextValue);
    setSelectedIds([]);
  }

  function toggleCard(card: Card) {
    const selectedIndex = selectedIds.indexOf(card.id);
    if (selectedIndex >= 0) {
      setSelectedIds((current) => current.filter((id) => id !== card.id));
      return;
    }

    if (selectedIds.length === 0 && !group?.playableStarterIds.has(card.id)) {
      return;
    }

    setSelectedIds((current) => [...current, card.id]);
  }

  function confirm() {
    if (selectedCards.length < 2) {
      return;
    }

    if (value === "wild" || value === "wild4") {
      setChoosingColor(true);
      return;
    }

    onPlay(selectedCards);
    close();
  }

  function playWild(color: Color) {
    if (selectedCards.length < 2) {
      close();
      return;
    }

    onPlay(selectedCards, color);
    close();
  }

  if (groups.length === 0 && !open) {
    return null;
  }

  return (
    <>
      <div className="grid gap-2">
        {!open ? (
          <div className="flex justify-center">
            <button type="button" className="button batch-button !min-h-9 !px-4 text-sm" onClick={() => setOpen(true)} aria-keyshortcuts="B">
              {t("batch.open")}
            </button>
          </div>
        ) : (
          <motion.section
            className="batch-selector"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            aria-label={t("batch.title")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="display font-black">{t("batch.title")}</h3>
                <p className="text-xs text-[var(--muted)]">{value === null ? t("batch.chooseValue") : t("batch.chooseOrder")}</p>
              </div>
              <button type="button" className="button secondary !min-h-8 !px-3 text-xs" onClick={close} aria-keyshortcuts="Escape">
                {t("common.cancel")}
              </button>
            </div>

            {value === null ? (
              <div className="batch-value-list">
                {groups.map((item) => (
                  <button key={String(item.value)} type="button" className="batch-value-option" onClick={() => chooseGroup(item.value)}>
                    <span className="display text-lg font-black">{batchValueText(item.value)}</span>
                    <span className="text-xs text-[var(--muted)]">{t("batch.cardCount", { count: item.cards.length })}</span>
                  </button>
                ))}
              </div>
            ) : group ? (
              <>
                <div className="batch-card-list thin-scroll">
                  <AnimatePresence initial={false}>
                    {group.cards.map((card) => {
                      const order = selectedIds.indexOf(card.id);
                      const disabled = selectedIds.length === 0 && !group.playableStarterIds.has(card.id);
                      return (
                        <motion.button
                          key={card.id}
                          type="button"
                          layout
                          className={`batch-card-choice ${order >= 0 ? "selected" : ""}`}
                          aria-label={t("batch.selectCard", { card: `${card.color ?? "Wild"} ${batchValueText(card.value)}` })}
                          disabled={disabled}
                          onClick={() => toggleCard(card)}
                          whileTap={{ scale: 0.95 }}
                        >
                          {order >= 0 ? <span className="batch-order-badge">{order + 1}</span> : null}
                          <CardView card={card} dimmed={disabled} />
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className="button secondary !min-h-9 !px-4 text-sm" onClick={() => chooseGroup(value)}>
                    {t("batch.clear")}
                  </button>
                  <button type="button" className="button !min-h-9 !px-4 text-sm" disabled={selectedCards.length < 2} onClick={confirm}>
                    {t("batch.play", { count: selectedCards.length })}
                  </button>
                </div>
              </>
            ) : null}
          </motion.section>
        )}
      </div>
      {choosingColor ? <ColorPicker onPick={playWild} onCancel={() => setChoosingColor(false)} /> : null}
    </>
  );
}
