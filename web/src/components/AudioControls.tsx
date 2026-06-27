"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getSfxVolume, setSfxVolume } from "@/lib/audio";
import { getMusicVolume, isMusicMuted, setMusicMuted, setMusicVolume, unlockMusic } from "@/lib/music";
import { isSoundMuted, playSound, setSoundMuted, unlockSound } from "@/lib/sound";

export function AudioControls() {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [musicMuted, setMusicMutedState] = useState(false);
  const [sfxMuted, setSfxMutedState] = useState(false);
  const [musicVol, setMusicVol] = useState(1);
  const [sfxVol, setSfxVol] = useState(1);
  const lastSfxTick = useRef(0);

  // Read persisted state on mount only (avoids SSR/client hydration mismatch).
  useEffect(() => {
    setMusicMutedState(isMusicMuted());
    setSfxMutedState(isSoundMuted());
    setMusicVol(getMusicVolume());
    setSfxVol(getSfxVolume());
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggleMusicMute() {
    const next = !musicMuted;
    setMusicMutedState(next);
    setMusicMuted(next);
    if (!next) {
      unlockMusic();
    }
  }

  function toggleSfxMute() {
    const next = !sfxMuted;
    setSfxMutedState(next);
    setSoundMuted(next);
    if (!next) {
      unlockSound();
    }
  }

  function changeMusicVol(value: number) {
    setMusicVol(value);
    setMusicVolume(value);
    unlockMusic();
  }

  function changeSfxVol(value: number) {
    setSfxVol(value);
    setSfxVolume(value);
    unlockSound();
    // Throttled tick so the user hears the new SFX level while dragging.
    const now = performance.now();
    if (now - lastSfxTick.current > 110) {
      lastSfxTick.current = now;
      playSound("uiClick");
    }
  }

  return (
    <div ref={containerRef} className="relative" data-sfx="off">
      <button
        type="button"
        className="toolbar-pill text-[var(--text)] transition-colors hover:border-[var(--gold)]"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">🔊</span>
        <span>{t("common.audio")}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t("common.audio")}
          className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-left shadow-[0_18px_48px_rgba(0,0,0,0.5)]"
        >
          <AudioRow
            label={t("common.music")}
            sliderLabel={`${t("common.music")} ${t("common.volume")}`}
            muteLabel={musicMuted ? t("common.musicOff") : t("common.musicOn")}
            muted={musicMuted}
            volume={musicVol}
            onToggleMute={toggleMusicMute}
            onChangeVolume={changeMusicVol}
          />
          <div className="my-2.5 h-px bg-[var(--line)]" />
          <AudioRow
            label={t("common.sfx")}
            sliderLabel={`${t("common.sfx")} ${t("common.volume")}`}
            muteLabel={sfxMuted ? t("common.soundOff") : t("common.soundOn")}
            muted={sfxMuted}
            volume={sfxVol}
            onToggleMute={toggleSfxMute}
            onChangeVolume={changeSfxVol}
          />
        </div>
      ) : null}
    </div>
  );
}

function AudioRow({
  label,
  sliderLabel,
  muteLabel,
  muted,
  volume,
  onToggleMute,
  onChangeVolume
}: {
  label: string;
  sliderLabel: string;
  muteLabel: string;
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onChangeVolume: (value: number) => void;
}) {
  return (
    <div className={`grid gap-1.5 transition-opacity ${muted ? "opacity-55" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-[var(--text)]">{label}</span>
        <span className="tabular-nums text-xs font-bold text-[var(--muted)]">{Math.round(volume * 100)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-base leading-none transition-colors hover:bg-white/10"
          aria-pressed={!muted}
          aria-label={muteLabel}
          onClick={onToggleMute}
        >
          <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          aria-label={sliderLabel}
          onChange={(event) => onChangeVolume(Number.parseFloat(event.target.value))}
          className="w-full"
          style={{ accentColor: "var(--gold)" }}
        />
      </div>
    </div>
  );
}
