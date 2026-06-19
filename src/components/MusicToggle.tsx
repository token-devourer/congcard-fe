"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { isMusicMuted, setMusicMuted } from "@/lib/music";

export function MusicToggle() {
  const t = useTranslations();
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isMusicMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMusicMuted(next);
  }

  return (
    <button className="toolbar-pill text-[var(--text)]" onClick={toggle} type="button">
      {muted ? t("common.musicOff") : t("common.musicOn")}
    </button>
  );
}
