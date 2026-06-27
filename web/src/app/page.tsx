"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DoorOpen, KeyRound, LoaderCircle, Sparkles, Users } from "lucide-react";
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
    <main className="landing-shell">
      <div className="app-shell">
        <header className="landing-nav">
          <div className="brand-lockup">
            <img src="/icon.svg" alt="" />
            <strong>{t("common.appName")}</strong>
          </div>
          <LanguageToggle />
        </header>

        <section className="landing-stage">
          <div className="landing-copy">
            <div className="section-label flex items-center gap-2">
              <Sparkles size={14} aria-hidden="true" />
              {t("common.appName")}
            </div>
            <h1 className="landing-title display">{t("landing.headline")}</h1>
            <p className="landing-subtitle flex items-center gap-2">
              <Users size={19} aria-hidden="true" />
              {t("landing.subline")}
            </p>

            <div className="hero-card-stage" aria-hidden="true">
              <div className="flex">
                {HERO_CARDS.map((card, index) => {
                  const center = (HERO_CARDS.length - 1) / 2;
                  return (
                    <motion.div
                      key={card.id}
                      className="-ml-8 first:ml-0"
                      style={{ transformOrigin: "bottom center", zIndex: index }}
                      animate={{
                        y: Math.abs(index - center) * 9,
                        rotate: (index - center) * 9
                      }}
                      whileHover={{ y: Math.abs(index - center) * 9 - 16, scale: 1.06 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    >
                      <CardView card={card} />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          <section className="landing-profile surface" aria-label={t("landing.nickname")}>
            <p className="section-label">{t("landing.avatar")}</p>
            <h2 className="landing-form-heading">{t("landing.create")}</h2>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[var(--text-soft)]">{t("landing.nickname")}</span>
                <input
                  className="field"
                  maxLength={20}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  autoComplete="nickname"
                />
              </label>

              <div className="grid gap-2">
                <span className="text-sm font-bold text-[var(--text-soft)]">{t("landing.avatar")}</span>
                <AvatarGrid value={avatarId} onChange={setAvatarId} />
              </div>

              <form onSubmit={submitCreate}>
                <button className="button flex w-full items-center justify-center gap-2" disabled={busy || !nickname.trim()}>
                  {busy ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <DoorOpen size={18} aria-hidden="true" />}
                  {t("landing.create")}
                </button>
              </form>

              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--text-faint)]">
                <span className="h-px flex-1 bg-[var(--border-soft)]" />
                {t("landing.join")}
                <span className="h-px flex-1 bg-[var(--border-soft)]" />
              </div>

              <form className="landing-action-grid" onSubmit={submitJoin}>
                <label className="sr-only" htmlFor="room-code">{t("landing.roomCode")}</label>
                <input
                  id="room-code"
                  className="field uppercase"
                  maxLength={6}
                  value={roomCode}
                  onChange={(event) => setRoomCode(formatRoomCodeInput(event.target.value))}
                  placeholder="ABC234"
                  inputMode="text"
                  autoComplete="off"
                />
                <button
                  className="button secondary flex items-center justify-center gap-2"
                  disabled={busy || roomCode.trim().length < 6 || !nickname.trim()}
                >
                  <KeyRound size={18} aria-hidden="true" />
                  {t("landing.join")}
                </button>
              </form>

              {error ? <p className="landing-error" role="alert">{error}</p> : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
