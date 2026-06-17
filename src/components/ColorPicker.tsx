"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { Color } from "@congcard/shared";
import { COLORS } from "@congcard/shared";

interface ColorPickerProps {
  disabled?: boolean;
  onPick: (color: Color) => void;
  onCancel: () => void;
}

export function ColorPicker({ disabled = false, onPick, onCancel }: ColorPickerProps) {
  const t = useTranslations();

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-3 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.7, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 24 }}
        className="mobile-modal panel grid max-w-sm gap-4 p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="display text-center text-[clamp(1.5rem,7vw,2rem)] font-black">{t("colorPicker.title")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map((color, index) => (
            <motion.button
              key={color}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 380, damping: 20 }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className={`card-${color} display h-[clamp(72px,18dvh,96px)] rounded-xl border-2 border-white/30 text-[clamp(1rem,4.8vw,1.25rem)] font-black ${
                color === "yellow" ? "text-[#221706]" : "text-white"
              }`}
              style={{ boxShadow: "var(--shadow-pop)" }}
              disabled={disabled}
              onClick={() => onPick(color)}
            >
              {t(`colors.${color}`)}
            </motion.button>
          ))}
        </div>
        <button className="button secondary" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </motion.div>
    </motion.div>
  );
}
