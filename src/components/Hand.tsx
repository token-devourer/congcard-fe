"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { Card, Color, GameSnapshot } from "@congcard/shared";
import { canPlayCard } from "@/lib/rules";
import { groupHand, shouldUseGroupedHand, type HandGroup, type HandGroupId } from "@/lib/handGroups";
import { CardView } from "./CardView";
import { BatchSelector, type BatchShortcutCommand } from "./BatchSelector";

interface HandProps {
  snapshot: GameSnapshot;
  isMyTurn: boolean;
  actionLocked?: boolean;
  batchShortcutCommand?: BatchShortcutCommand | null;
  onPlay: (card: Card) => void;
  onPlayBatch?: (cards: Card[], declaredColor?: Color) => void;
  onBatchSelectionChange?: (active: boolean) => void;
  onPassDrawn: () => void;
}

const CARD_WIDTH = { normal: 88, compact: 56 };
const CARD_WIDTH_NARROW = { normal: 70, compact: 46 };
const MIN_VISIBLE_STEP = 14;
const MIN_OVERLAP = 24;
const NOOP_BATCH_PLAY = () => undefined;
const NOOP_BATCH_SELECTION = () => undefined;

export function Hand({
  snapshot,
  isMyTurn,
  actionLocked = false,
  batchShortcutCommand,
  onPlay,
  onPlayBatch = NOOP_BATCH_PLAY,
  onBatchSelectionChange = NOOP_BATCH_SELECTION,
  onPassDrawn
}: HandProps) {
  const t = useTranslations();
  const stackRef = useRef<HTMLDivElement | null>(null);
  const [stackWidth, setStackWidth] = useState(0);
  const [isNarrow, setIsNarrow] = useState(false);
  const [batchActive, setBatchActive] = useState(false);
  const hand = snapshot.self?.hand ?? [];
  const drawnId = snapshot.self?.drawnCardId;
  const drawnCount = drawnId ? 1 : 0;
  const count = hand.length;
  const grouped = shouldUseGroupedHand(count, isNarrow);
  const handleBatchSelectionChange = useCallback(
    (active: boolean) => {
      setBatchActive(active);
      onBatchSelectionChange(active);
    },
    [onBatchSelectionChange]
  );

  useEffect(() => {
    const element = stackRef.current;
    if (!element) {
      return undefined;
    }

    const update = () => {
      const styles = window.getComputedStyle(element);
      const padding = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
      setStackWidth(element.clientWidth - padding);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [grouped]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <div className="grid gap-2">
      <BatchSelector
        snapshot={snapshot}
        actionLocked={actionLocked}
        shortcutCommand={batchShortcutCommand}
        onSelectionChange={handleBatchSelectionChange}
        onPlay={onPlayBatch}
      />
      {drawnId && isMyTurn ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-3 text-sm font-bold"
        >
          <span className="rounded-full bg-black/40 px-3 py-1.5">{t("board.drawnBadge", { count: drawnCount })} ✨</span>
          <button className="button secondary !min-h-9 !px-4 text-sm" disabled={actionLocked} onClick={onPassDrawn} aria-keyshortcuts="P">
            {t("board.passDrawn")}
          </button>
        </motion.div>
      ) : null}

      {!batchActive && grouped ? (
        <GroupedHand snapshot={snapshot} actionLocked={actionLocked} onPlay={onPlay} />
      ) : !batchActive ? (
        <FanHand
          snapshot={snapshot}
          actionLocked={actionLocked}
          stackRef={stackRef}
          stackWidth={stackWidth}
          isNarrow={isNarrow}
          onPlay={onPlay}
        />
      ) : null}
    </div>
  );
}

function FanHand({
  snapshot,
  actionLocked,
  stackRef,
  stackWidth,
  isNarrow,
  onPlay
}: {
  snapshot: GameSnapshot;
  actionLocked: boolean;
  stackRef: RefObject<HTMLDivElement | null>;
  stackWidth: number;
  isNarrow: boolean;
  onPlay: (card: Card) => void;
}) {
  const t = useTranslations();
  const hand = snapshot.self?.hand ?? [];
  const drawnId = snapshot.self?.drawnCardId;
  const drawnCount = drawnId ? 1 : 0;
  const count = hand.length;
  const compact = count > 24;
  const cardWidth = isNarrow
    ? CARD_WIDTH_NARROW[compact ? "compact" : "normal"]
    : CARD_WIDTH[compact ? "compact" : "normal"];
  const usableWidth = Math.min(stackWidth > 0 ? stackWidth : 640, 1040);
  const maxPerRow = Math.max(1, Math.floor((usableWidth - cardWidth) / MIN_VISIBLE_STEP) + 1);
  const rowCountBySize = count <= 12 ? 1 : count <= 24 ? 2 : 3;
  const rowCount = Math.min(4, Math.max(rowCountBySize, Math.ceil(count / maxPerRow)));
  const rows = chunkCards(hand, rowCount);
  const longestRow = rows.reduce((max, row) => Math.max(max, row.length), 1);
  const step =
    longestRow > 1 ? Math.min(cardWidth - MIN_OVERLAP, (usableWidth - cardWidth) / (longestRow - 1)) : 0;
  const overlap = longestRow > 1 ? Math.max(0, cardWidth - step) : 0;

  return (
    <div ref={stackRef} className="hand-stack pb-2 pt-5">
      {rows.map((row, rowIndex) => {
        const center = (row.length - 1) / 2;
        const spreadDeg = row.length > 1 ? Math.min(5, 40 / row.length) : 0;
        const arcPx = row.length > 1 ? Math.min(4, 30 / row.length) : 0;

        return (
          <div key={rowIndex} className="hand-row">
            <AnimatePresence initial={false}>
              {row.map((card, index) => {
                const playable = !actionLocked && canPlayCard(snapshot, card);
                const isDrawn = card.id === drawnId;
                const cardIndex = rowIndex * 100 + index;
                const layer = cardIndex + (playable ? 1000 : 0) + (isDrawn ? 1000 : 0);

                return (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ y: 70, opacity: 0 }}
                    animate={{
                      y: Math.abs(index - center) * arcPx,
                      rotate: (index - center) * spreadDeg,
                      opacity: 1
                    }}
                    exit={{ y: -90, opacity: 0, scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    className="relative"
                    style={{
                      marginLeft: index === 0 ? 0 : -overlap,
                      transformOrigin: "bottom center",
                      zIndex: layer
                    }}
                  >
                    {isDrawn ? (
                      <span className="display absolute -top-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-black text-black">
                        {t("board.drawnBadge", { count: drawnCount })}
                      </span>
                    ) : null}
                    <CardView
                      card={card}
                      small={compact}
                      playable={playable}
                      dimmed={actionLocked || (!playable && Boolean(snapshot.currentPlayerId))}
                      disabled={!playable}
                      onClick={() => onPlay(card)}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function GroupedHand({
  snapshot,
  actionLocked,
  onPlay
}: {
  snapshot: GameSnapshot;
  actionLocked: boolean;
  onPlay: (card: Card) => void;
}) {
  const t = useTranslations();
  const [hoveredGroup, setHoveredGroup] = useState<HandGroupId | null>(null);
  const [pinnedGroup, setPinnedGroup] = useState<HandGroupId | null>(null);
  const [closedDefaultKey, setClosedDefaultKey] = useState<string | null>(null);
  const groups = groupHand(snapshot, actionLocked).filter((group) => group.count > 0);
  const groupIds = groups.map((group) => group.id).join("|");
  const defaultKey = `${snapshot.activeColor ?? "none"}:${groups
    .map((group) => `${group.id}:${group.cards.map((item) => item.card.id).join(",")}`)
    .join("|")}`;
  const defaultGroupId = defaultTrayGroupId(groups, snapshot.activeColor ?? null);
  const activeGroupId = pinnedGroup ?? hoveredGroup ?? (closedDefaultKey === defaultKey ? null : defaultGroupId);
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;

  useEffect(() => {
    const existingIds = new Set(groups.map((group) => group.id));
    setPinnedGroup((current) => (current && existingIds.has(current) ? current : null));
    setHoveredGroup((current) => (current && existingIds.has(current) ? current : null));
  }, [groupIds]);

  function groupLabel(id: HandGroupId): string {
    return t(`colors.${id}`);
  }

  function showGroup(group: HandGroup) {
    setPinnedGroup(group.id);
    setHoveredGroup(null);
    setClosedDefaultKey(null);
  }

  function closeTray() {
    setPinnedGroup(null);
    setHoveredGroup(null);
    setClosedDefaultKey(defaultKey);
  }

  return (
    <div
      className="hand-group-mode"
      onMouseLeave={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setHoveredGroup(null);
        }
      }}
    >
      <ExpandedGroup
        group={activeGroup}
        label={activeGroup ? groupLabel(activeGroup.id) : ""}
        actionLocked={actionLocked}
        onClose={closeTray}
        onPlay={onPlay}
      />

      <div className="hand-group-rail" aria-label={t("board.groupedHand")}>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            className={`hand-group-pile ${group.playableCount > 0 ? "playable" : ""} ${activeGroupId === group.id ? "active" : ""}`}
            onMouseEnter={() => setHoveredGroup(group.id)}
            onClick={() => showGroup(group)}
            aria-pressed={pinnedGroup === group.id}
            aria-label={`${groupLabel(group.id)}: ${t("board.groupCards", { count: group.count })}`}
          >
            <PilePreview group={group} />
            <span className="hand-group-meta">
              <span className="display text-sm font-black">{groupLabel(group.id)}</span>
              <span className="text-xs font-bold text-[var(--muted)]">{t("board.groupCards", { count: group.count })}</span>
              {group.playableCount > 0 ? (
                <span className="hand-group-playable-badge">{t("board.groupPlayable", { count: group.playableCount })}</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function defaultTrayGroupId(groups: HandGroup[], activeColor: Color | null): HandGroupId | null {
  if (activeColor && groups.some((group) => group.id === activeColor)) {
    return activeColor;
  }

  return groups.find((group) => group.playableCount > 0)?.id ?? null;
}

function PilePreview({ group }: { group: HandGroup }) {
  const preview = group.cards.slice(0, 4);

  return (
    <span className="hand-group-preview" aria-hidden="true">
      {preview.map((item, index) => (
        <span
          key={item.card.id}
          className="hand-group-card-preview"
          style={{
            transform: `translateX(${index * 11}px) rotate(${(index - 1.5) * 5}deg)`,
            zIndex: index
          }}
        >
          <CardView card={item.card} small dimmed={!item.playable} />
        </span>
      ))}
    </span>
  );
}

function ExpandedGroup({
  group,
  label,
  actionLocked,
  onClose,
  onPlay
}: {
  group: HandGroup | null;
  label: string;
  actionLocked: boolean;
  onClose: () => void;
  onPlay: (card: Card) => void;
}) {
  const t = useTranslations();
  const drawnCount = group?.drawnCount ?? 0;

  return (
    <motion.div
      className={`hand-group-expanded ${group ? "open" : ""}`}
      data-testid="hand-group-expanded"
      data-group-id={group?.id ?? ""}
      aria-hidden={!group}
      initial={false}
      animate={group ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
    >
      {group ? (
        <>
      <div className="hand-group-expanded-header">
        <div>
          <h3 className="display text-base font-black">{label}</h3>
          <p className="text-xs font-bold text-[var(--muted)]">
            {t("board.groupCards", { count: group.count })}
            {group.playableCount > 0 ? ` / ${t("board.groupPlayable", { count: group.playableCount })}` : ""}
          </p>
        </div>
        <button type="button" className="button secondary !min-h-8 !px-3 text-xs" onClick={onClose}>
          {t("board.groupAll")}
        </button>
      </div>

      <div className="hand-group-expanded-cards thin-scroll">
        <AnimatePresence initial={false}>
          {group.cards.map((item) => (
            <motion.div
              key={item.card.id}
              layout
              className="hand-group-card"
              initial={{ opacity: 0, y: 22, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              {item.drawn ? (
                <span className="display absolute -top-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-black text-black">
                  {t("board.drawnBadge", { count: drawnCount })}
                </span>
              ) : null}
              <CardView
                card={item.card}
                playable={item.playable}
                dimmed={actionLocked || !item.playable}
                disabled={!item.playable}
                onClick={() => onPlay(item.card)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
        </>
      ) : null}
    </motion.div>
  );
}

function chunkCards(cards: Card[], rowCount: number): Card[][] {
  const perRow = Math.ceil(cards.length / rowCount);

  return Array.from({ length: rowCount }, (_, index) => cards.slice(index * perRow, (index + 1) * perRow)).filter(
    (row) => row.length > 0
  );
}
