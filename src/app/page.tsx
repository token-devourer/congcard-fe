"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AVATARS } from "@kartu-satu/shared";
import { createRoom, resolveRoom } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("Player");
  const [avatarId, setAvatarId] = useState<(typeof AVATARS)[number]>("sun");
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedName = window.localStorage.getItem("kartu-satu:nickname");
    const savedAvatar = window.localStorage.getItem("kartu-satu:avatar");
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
      router.push(`/room/${room.code}?roomId=${room.roomId}`);
    });
  }

  async function submitJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withProfile(async () => {
      const room = await resolveRoom(roomCode.trim());
      router.push(`/room/${room.code}?roomId=${room.roomId}`);
    });
  }

  async function withProfile(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      window.localStorage.setItem("kartu-satu:nickname", nickname.trim() || "Player");
      window.localStorage.setItem("kartu-satu:avatar", avatarId);
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell py-6 md:py-10">
      <section className="grid min-h-[calc(100vh-80px)] content-center gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Kartu Satu</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight md:text-6xl">Private room card battles for friends.</h1>
          </div>
          <div className="grid grid-cols-4 gap-3 rounded-lg border border-[var(--line)] bg-black/20 p-4">
            {["red", "yellow", "green", "blue"].map((color) => (
              <div key={color} className={`h-24 rounded-lg card-${color}`} />
            ))}
          </div>
        </div>

        <div className="panel p-4 md:p-6">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[var(--muted)]">Nickname</span>
              <input className="field" maxLength={20} value={nickname} onChange={(event) => setNickname(event.target.value)} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[var(--muted)]">Avatar</span>
              <select className="field" value={avatarId} onChange={(event) => setAvatarId(event.target.value as (typeof AVATARS)[number])}>
                {AVATARS.map((avatar) => (
                  <option key={avatar} value={avatar}>
                    {avatar}
                  </option>
                ))}
              </select>
            </label>

            <form className="grid gap-3" onSubmit={submitCreate}>
              <button className="button" disabled={busy || !nickname.trim()}>
                Create private room
              </button>
            </form>

            <form className="grid gap-3" onSubmit={submitJoin}>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[var(--muted)]">Room code</span>
                <input
                  className="field uppercase"
                  maxLength={6}
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                />
              </label>
              <button className="button secondary" disabled={busy || roomCode.trim().length < 6 || !nickname.trim()}>
                Join room
              </button>
            </form>

            {error ? <p className="rounded-lg border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100">{error}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
