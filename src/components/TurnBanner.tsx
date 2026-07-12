"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRoomStore } from "@/lib/store";

export function TurnBanner() {
  const t = useTranslations();
  const events = useRoomStore((state) => state.events);
  const snapshot = useRoomStore((state) => state.snapshot);
  const dismissEvent = useRoomStore((state) => state.dismissEvent);
  const chaosBlocking = Boolean(
    snapshot?.pendingChaos &&
    !(snapshot.pendingChaos.kind === "nuke" && snapshot.pendingChaos.phase === "countdown")
  );
  const turnEvent = !chaosBlocking && snapshot && snapshot.currentPlayerId === snapshot.self?.id
    ? events.find((event) => event.type === "yourTurn")
    : undefined;

  useEffect(() => {
    if (!turnEvent) {
      return undefined;
    }

    const id = window.setTimeout(() => dismissEvent(turnEvent.id), 2000);
    return () => window.clearTimeout(id);
  }, [turnEvent, dismissEvent]);

  return (
    <AnimatePresence>
      {turnEvent ? (
        <motion.div
          key={turnEvent.id}
          className="pointer-events-none fixed inset-x-0 top-[18%] z-50 grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -5 }}
            animate={{ scale: [0.4, 1.12, 1], rotate: 0 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="display rounded-2xl border-2 border-white/30 px-10 py-4 text-4xl font-black text-[#221a07] md:text-6xl"
            style={{
              background: "linear-gradient(180deg, var(--gold-strong), var(--gold))",
              boxShadow: "0 0 60px rgba(242, 193, 78, 0.65), var(--shadow-pop)"
            }}
          >
            {t("events.yourTurn")}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
