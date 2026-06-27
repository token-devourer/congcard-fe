"use client";

import { useTranslations } from "next-intl";
import { AVATARS } from "@congcard/shared";
import { Avatar } from "./Avatar";

interface AvatarGridProps {
  value: (typeof AVATARS)[number];
  onChange: (avatar: (typeof AVATARS)[number]) => void;
}

export function AvatarGrid({ value, onChange }: AvatarGridProps) {
  const t = useTranslations();

  return (
    <div className="grid grid-cols-6 gap-2">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          title={t(`avatars.${avatar}`)}
          aria-label={t(`avatars.${avatar}`)}
          aria-pressed={value === avatar}
          className={`grid aspect-square place-items-center rounded-xl border p-1 transition-all ${
            value === avatar
              ? "border-[var(--gold)] bg-[var(--gold)]/15 shadow-[0_0_14px_rgba(242,193,78,0.35)]"
              : "border-[var(--line)] bg-black/25 hover:border-white/40"
          }`}
          onClick={() => onChange(avatar)}
        >
          <Avatar avatarId={avatar} size={44} className="h-full w-full" />
        </button>
      ))}
    </div>
  );
}
