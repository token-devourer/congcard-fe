"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { Color, FlipSide } from "@congcard/shared";
import { DARK_COLORS, LIGHT_COLORS } from "@congcard/shared";

interface ColorPickerProps {
  disabled?: boolean;
  onPick: (color: Color) => void;
  onCancel: () => void;
  flipSide?: FlipSide;
}

export function ColorPicker({ disabled = false, onPick, onCancel, flipSide }: ColorPickerProps) {
  const t = useTranslations();
  const colors = flipSide === "dark" ? DARK_COLORS : LIGHT_COLORS;

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/75 p-3 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
      data-testid="color-picker-overlay"
    >
      <motion.div
        initial={{ scale: 0.7, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 24 }}
        className="mobile-modal modal-color-picker panel grid gap-4 p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="display text-center text-[clamp(1.5rem,7vw,2rem)] font-black">{t("colorPicker.title")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {colors.map((color, index) => (
            <motion.button
              key={color}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 380, damping: 20 }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className={`card-${color} display h-[clamp(72px,18dvh,96px)] rounded-xl border-2 border-white/30 text-[clamp(1rem,4.8vw,1.25rem)] font-black ${
                color === "yellow" || color === "cyan" ? "text-[#221706]" : "text-white"
              }`}
              style={{ boxShadow: "var(--shadow-pop)" }}
              disabled={disabled}
              onClick={() => onPick(color)}
            >
              {t(`colors.${color}`)}
            </motion.button>
          ))}
        </div>
        <button className="button secondary" onClick={onCancel} aria-keyshortcuts="Escape">
          {t("common.cancel")}
        </button>
      </motion.div>
    </motion.div>
  );
}
