"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { Card } from "@congcard/shared";
import { AVATARS } from "@congcard/shared";
import { createRoom, resolveRoom } from "@/lib/api";
import { formatRoomCodeInput } from "@/lib/roomCode";
import { AvatarGrid } from "@/components/AvatarGrid";
import { CardView } from "@/components/CardView";
import { LanguageToggle } from "@/components/LanguageToggle";

const HERO_CARDS: Card[] = [
  { id: "hero-red-7", color: "red", value: 7, deckIndex: 0 },
  { id: "hero-yellow-skip", color: "yellow", value: "skip", deckIndex: 0 },
  { id: "hero-wild", color: null, value: "wild", deckIndex: 0 },
  { id: "hero-green-reverse", color: "green", value: "reverse", deckIndex: 0 },
  { id: "hero-blue-2", color: "blue", value: 2, deckIndex: 0 }
];

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const [nickname, setNickname] = useState("Player");
  const [avatarId, setAvatarId] = useState<(typeof AVATARS)[number]>("sun");
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedName = window.localStorage.getItem("congcard:nickname");
    const savedAvatar = window.localStorage.getItem("congcard:avatar");
    if (savedName) {
      setNickname(savedName);
    }

    if (savedAvatar && AVATARS.includes(savedAvatar as (typeof AVATARS)[number])) {
      setAvatarId(savedAvatar as (typeof AVATARS)[number]);
    }
  }, []);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withProfile(async () => {
      const room = await createRoom();
      router.push(`/room/${room.code}`);
    });
  }

  async function submitJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withProfile(async () => {
      const room = await resolveRoom(roomCode);
      router.push(`/room/${room.code}`);
    });
  }

  async function withProfile(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      window.localStorage.setItem("congcard:nickname", nickname.trim() || "Player");
      window.localStorage.setItem("congcard:avatar", avatarId);
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell py-6 md:py-10">
      <header className="flex items-center justify-between gap-3">
        <div className="display flex items-center gap-2 text-lg font-black">
          <img src="/icon.svg" alt="" className="h-10 w-10 rounded-xl" />
          <span>{t("common.appName")}</span>
        </div>
        <LanguageToggle />
      </header>
      <section className="grid min-h-[calc(100dvh-140px)] content-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-7">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="display text-sm font-black uppercase tracking-[0.18em] text-[var(--gold)]"
            >
              {t("common.appName")}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="display mt-3 max-w-2xl text-4xl font-black leading-tight md:text-6xl"
            >
              {t("landing.headline")}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-3 text-lg text-[var(--muted)]"
            >
              {t("landing.subline")}
            </motion.p>
          </div>

          <div className="flex justify-center py-6 md:justify-start">
            <div className="flex">
              {HERO_CARDS.map((card, index) => {
                const center = (HERO_CARDS.length - 1) / 2;
                return (
                  <motion.div
                    key={card.id}
                    className="-ml-8 first:ml-0"
                    style={{ transformOrigin: "bottom center", zIndex: index }}
                    initial={{ opacity: 0, y: 60, rotate: 0 }}
                    animate={{
                      opacity: 1,
                      y: Math.abs(index - center) * 9,
                      rotate: (index - center) * 9
                    }}
                    whileHover={{ y: Math.abs(index - center) * 9 - 16, scale: 1.06 }}
                    transition={{ delay: 0.25 + index * 0.09, type: "spring", stiffness: 260, damping: 20 }}
                  >
                    <CardView card={card} />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="panel p-4 md:p-6"
        >
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[var(--muted)]">{t("landing.nickname")}</span>
              <input className="field" maxLength={20} value={nickname} onChange={(event) => setNickname(event.target.value)} />
            </label>

            <div className="grid gap-2">
              <span className="text-sm font-bold text-[var(--muted)]">{t("landing.avatar")}</span>
              <AvatarGrid value={avatarId} onChange={setAvatarId} />
            </div>

            <form className="grid gap-3" onSubmit={submitCreate}>
              <button className="button" disabled={busy || !nickname.trim()}>
                {t("landing.create")}
              </button>
            </form>

            <form className="grid gap-3" onSubmit={submitJoin}>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[var(--muted)]">{t("landing.roomCode")}</span>
                <input
                  className="field uppercase"
                  maxLength={6}
                  value={roomCode}
                  onChange={(event) => setRoomCode(formatRoomCodeInput(event.target.value))}
                  placeholder="ABC234"
                />
              </label>
              <button className="button secondary" disabled={busy || roomCode.trim().length < 6 || !nickname.trim()}>
                {t("landing.join")}
              </button>
            </form>

            {error ? <p className="rounded-lg border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100">{error}</p> : null}
          </div>
        </motion.div>
      </section>
    </main>
  );
}
