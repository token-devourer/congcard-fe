"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Client, Room } from "@colyseus/sdk";
import type { Card, Color, GameSnapshot, PublicPlayer, RoomSettings } from "@kartu-satu/shared";
import { AVATARS, COLORS } from "@kartu-satu/shared";
import { resolveRoom } from "@/lib/api";
import { GAME_SERVER_URL } from "@/lib/config";
import { canPlayCard, needsColor } from "@/lib/rules";
import { useRoomStore } from "@/lib/store";
import { CardView } from "./CardView";

interface RoomClientProps {
  code: string;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "closed";

export function RoomClient({ code }: RoomClientProps) {
  const searchParams = useSearchParams();
  const roomIdFromUrl = searchParams.get("roomId");
  const roomRef = useRef<Room | null>(null);
  const connectingRef = useRef(false);
  const { snapshot, error, setSnapshot, setError, reset } = useRoomStore();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [nickname, setNickname] = useState("");
  const [avatarId, setAvatarId] = useState<(typeof AVATARS)[number]>("sun");
  const [profileReady, setProfileReady] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  useEffect(() => {
    const savedName = window.localStorage.getItem("kartu-satu:nickname");
    const savedAvatar = window.localStorage.getItem("kartu-satu:avatar");
    setNickname(savedName ?? "");
    if (savedAvatar && AVATARS.includes(savedAvatar as (typeof AVATARS)[number])) {
      setAvatarId(savedAvatar as (typeof AVATARS)[number]);
    }
    setProfileReady(true);

    return () => {
      roomRef.current?.leave();
      reset();
    };
  }, [reset]);

  const connect = useCallback(async () => {
    if (!nickname.trim() || connectingRef.current || roomRef.current) {
      return;
    }

    connectingRef.current = true;
    setStatus("connecting");
    setError("");

    try {
      const client = new Client(GAME_SERVER_URL);
      const reconnectKey = `kartu-satu:reconnect:${code}`;
      const token = window.localStorage.getItem(reconnectKey);
      let room: Room | null = null;

      if (token) {
        try {
          room = await client.reconnect(token);
        } catch {
          window.localStorage.removeItem(reconnectKey);
        }
      }

      if (!room) {
        const lookup = roomIdFromUrl ? { code, roomId: roomIdFromUrl } : await resolveRoom(code);
        room = await client.joinById(lookup.roomId, {
          nickname: nickname.trim(),
          avatarId
        });
      }

      roomRef.current = room;
      setStatus("connected");
      window.localStorage.setItem("kartu-satu:nickname", nickname.trim());
      window.localStorage.setItem("kartu-satu:avatar", avatarId);
      if (room.reconnectionToken) {
        window.localStorage.setItem(reconnectKey, room.reconnectionToken);
      }

      room.onMessage("state", (nextSnapshot: GameSnapshot) => {
        setSnapshot(nextSnapshot);
      });
      room.onMessage("error", (payload: { message?: string }) => {
        setError(payload.message ?? "Action failed.");
      });
      room.onLeave(() => {
        setStatus("closed");
        roomRef.current = null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection failed.");
      setStatus("closed");
    } finally {
      connectingRef.current = false;
    }
  }, [avatarId, code, nickname, roomIdFromUrl, setError, setSnapshot]);

  useEffect(() => {
    if (profileReady && nickname.trim()) {
      void connect();
    }
  }, [connect, nickname, profileReady]);

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void connect();
  }

  function send(type: string, payload?: unknown) {
    setError("");
    roomRef.current?.send(type, payload);
  }

  if (!profileReady) {
    return null;
  }

  if (!nickname.trim()) {
    return (
      <main className="app-shell grid min-h-screen place-items-center py-8">
        <form className="panel grid w-full max-w-md gap-4 p-5" onSubmit={submitProfile}>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Room {code}</p>
            <h1 className="mt-2 text-2xl font-black">Choose your seat name</h1>
          </div>
          <input className="field" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20} placeholder="Nickname" />
          <select className="field" value={avatarId} onChange={(event) => setAvatarId(event.target.value as (typeof AVATARS)[number])}>
            {AVATARS.map((avatar) => (
              <option key={avatar} value={avatar}>
                {avatar}
              </option>
            ))}
          </select>
          <button className="button" disabled={!nickname.trim() || status === "connecting"}>
            Join room
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell py-3 md:py-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Kartu Satu</p>
          <h1 className="text-2xl font-black">Room {code}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="rounded-full border border-[var(--line)] px-3 py-1">{status}</span>
          <a className="rounded-full border border-[var(--line)] px-3 py-1 text-[var(--text)]" href="/rules">
            Rules
          </a>
        </div>
      </header>

      {error ? <div className="mb-3 rounded-lg border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100">{error}</div> : null}

      {!snapshot ? (
        <div className="panel grid min-h-[420px] place-items-center p-6 text-[var(--muted)]">Connecting to room...</div>
      ) : snapshot.phase === "lobby" ? (
        <Lobby snapshot={snapshot} send={send} />
      ) : (
        <Board snapshot={snapshot} send={send} selectedCard={selectedCard} setSelectedCard={setSelectedCard} />
      )}
    </main>
  );
}

function Lobby({ snapshot, send }: { snapshot: GameSnapshot; send: (type: string, payload?: unknown) => void }) {
  const me = snapshot.players.find((player) => player.id === snapshot.self?.id);
  const isHost = Boolean(me?.isHost);

  function updateSetting(input: Partial<RoomSettings>) {
    send("room.updateSettings", input);
  }

  return (
    <section className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="panel p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">Players</h2>
          <button className="button secondary" onClick={() => send("room.ready", { ready: !me?.ready })}>
            {me?.ready ? "Set not ready" : "Ready"}
          </button>
        </div>
        <div className="grid gap-3">
          {snapshot.players.map((player) => (
            <div key={player.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-black/20 p-3">
              <div>
                <div className="font-bold">
                  {player.nickname} {player.isHost ? "(host)" : ""}
                </div>
                <div className="text-sm text-[var(--muted)]">
                  {player.avatarId} · {player.ready ? "ready" : "waiting"} · {player.connected ? "online" : "offline"}
                </div>
              </div>
              {isHost && !player.isHost ? (
                <button className="button danger" onClick={() => send("room.kick", { playerId: player.id })}>
                  Kick
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <aside className="panel grid content-start gap-4 p-4">
        <h2 className="text-xl font-black">Room settings</h2>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[var(--muted)]">Max players</span>
          <select className="field" disabled={!isHost} value={snapshot.settings.maxPlayers} onChange={(event) => updateSetting({ maxPlayers: Number(event.target.value) })}>
            {Array.from({ length: 9 }, (_, index) => index + 2).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[var(--muted)]">Turn timer</span>
          <select className="field" disabled={!isHost} value={snapshot.settings.turnTimeoutSec} onChange={(event) => updateSetting({ turnTimeoutSec: Number(event.target.value) })}>
            {[15, 30, 45, 60].map((value) => (
              <option key={value} value={value}>
                {value} seconds
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[var(--muted)]">Score target</span>
          <select className="field" disabled={!isHost} value={snapshot.settings.scoreTarget} onChange={(event) => updateSetting({ scoreTarget: Number(event.target.value) as RoomSettings["scoreTarget"] })}>
            <option value={0}>One round</option>
            <option value={500}>500 points</option>
          </select>
        </label>
        <button className="button" disabled={!isHost || snapshot.players.length < 2} onClick={() => send("game.start")}>
          Start game
        </button>
      </aside>
    </section>
  );
}

function Board({
  snapshot,
  send,
  selectedCard,
  setSelectedCard
}: {
  snapshot: GameSnapshot;
  send: (type: string, payload?: unknown) => void;
  selectedCard: Card | null;
  setSelectedCard: (card: Card | null) => void;
}) {
  const me = snapshot.players.find((player) => player.id === snapshot.self?.id);
  const opponents = snapshot.players.filter((player) => player.id !== snapshot.self?.id);
  const activePlayer = snapshot.players.find((player) => player.id === snapshot.currentPlayerId);
  const challengeForMe = snapshot.pendingChallenge?.challengerId === snapshot.self?.id;
  const oneTarget = snapshot.oneWindow ? snapshot.players.find((player) => player.id === snapshot.oneWindow?.playerId) : undefined;
  const isMyTurn = snapshot.currentPlayerId === snapshot.self?.id && !snapshot.pendingChallenge;
  const canCallOne = snapshot.self?.hand.length === 1 && !me?.calledOne;
  const drawnCard = snapshot.self?.hand.find((card) => card.id === snapshot.self?.drawnCardId);

  function play(card: Card) {
    if (!canPlayCard(snapshot, card)) {
      return;
    }

    if (needsColor(card)) {
      setSelectedCard(card);
      return;
    }

    send("game.playCard", { cardId: card.id });
  }

  function chooseColor(color: Color) {
    if (!selectedCard) {
      return;
    }

    send("game.playCard", { cardId: selectedCard.id, declaredColor: color });
    setSelectedCard(null);
  }

  return (
    <section className="board">
      <div className="grid gap-3 md:grid-cols-[1fr_260px]">
        <div className="flex flex-wrap justify-center gap-2">
          {opponents.map((player) => (
            <PlayerSeat key={player.id} player={player} active={player.id === snapshot.currentPlayerId} oneOpen={snapshot.oneWindow?.playerId === player.id} onCatch={() => send("game.catchOne", { targetId: player.id })} />
          ))}
        </div>
        <ActionLog snapshot={snapshot} />
      </div>

      <div className="panel grid place-items-center p-4">
        <div className="grid w-full max-w-3xl gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="text-center md:text-right">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Turn</div>
            <div className="mt-1 text-2xl font-black">{activePlayer?.nickname ?? "Waiting"}</div>
            <Timer deadline={snapshot.turnDeadline} />
          </div>

          <div className="flex items-center justify-center gap-4">
            <button className="grid gap-2 text-center" disabled={!isMyTurn} onClick={() => send("game.drawCard")} aria-label="Draw card">
              <CardView hidden />
              <span className="button secondary">Draw</span>
            </button>
            <div className="grid gap-2 text-center">
              <CardView card={snapshot.discardTop} />
              <span className={`rounded-full px-3 py-1 text-sm font-black card-${snapshot.activeColor ?? "wild"}`}>Active {snapshot.activeColor ?? "wild"}</span>
            </div>
          </div>

          <div className="text-center md:text-left">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Direction</div>
            <div className="mt-1 text-2xl font-black">{snapshot.direction === 1 ? "Clockwise" : "Counterclockwise"}</div>
            <div className="text-sm text-[var(--muted)]">{snapshot.drawPileCount} cards in draw pile</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {challengeForMe ? (
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
            <span className="font-bold">Wild Draw Four challenge</span>
            <div className="flex gap-2">
              <button className="button secondary" onClick={() => send("game.challenge", { accept: false })}>
                Take four
              </button>
              <button className="button" onClick={() => send("game.challenge", { accept: true })}>
                Challenge
              </button>
            </div>
          </div>
        ) : null}

        {snapshot.phase === "roundEnd" || snapshot.phase === "gameEnd" ? <RoundPanel snapshot={snapshot} send={send} /> : null}

        <div className="panel p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <PlayerSeat player={me} active={isMyTurn} oneOpen={snapshot.oneWindow?.playerId === me?.id} />
            <div className="flex flex-wrap gap-2">
              {canCallOne ? (
                <button className="button" onClick={() => send("game.callOne")}>
                  One!
                </button>
              ) : null}
              {oneTarget && oneTarget.id !== me?.id ? (
                <button className="button danger" onClick={() => send("game.catchOne", { targetId: oneTarget.id })}>
                  Catch {oneTarget.nickname}
                </button>
              ) : null}
              {drawnCard ? (
                <button className="button secondary" onClick={() => send("game.playDrawn", { play: false })}>
                  Pass drawn card
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-[112px] gap-2 overflow-x-auto px-2 py-3">
            {snapshot.self?.hand.map((card) => {
              const playable = canPlayCard(snapshot, card);
              return <CardView key={card.id} card={card} playable={playable} disabled={!playable} onClick={() => play(card)} />;
            })}
          </div>
        </div>
      </div>

      {selectedCard ? <ColorPicker onPick={chooseColor} onCancel={() => setSelectedCard(null)} /> : null}
    </section>
  );
}

function PlayerSeat({
  player,
  active,
  oneOpen,
  onCatch
}: {
  player?: PublicPlayer;
  active?: boolean;
  oneOpen?: boolean;
  onCatch?: () => void;
}) {
  if (!player) {
    return null;
  }

  return (
    <div className={`seat ${active ? "active" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-black">{player.nickname}</div>
        <div className="rounded-full bg-black/30 px-2 py-1 text-xs font-bold">{player.avatarId}</div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-sm text-[var(--muted)]">
        <span>{player.cardCount} cards</span>
        <span>{player.score} pts</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className={player.connected ? "text-green-200" : "text-red-200"}>{player.connected ? "online" : "offline"}</span>
        {oneOpen && onCatch ? (
          <button className="rounded bg-[var(--red)] px-2 py-1 font-bold text-white" onClick={onCatch}>
            Catch
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ActionLog({ snapshot }: { snapshot: GameSnapshot }) {
  return (
    <aside className="panel hidden max-h-48 overflow-auto p-3 md:block">
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] text-[var(--muted)]">Log</h2>
      <div className="grid gap-2 text-sm">
        {snapshot.actionLog.slice(-8).map((entry) => (
          <div key={entry.seq} className="rounded border border-[var(--line)] bg-black/20 p-2">
            {entry.message}
          </div>
        ))}
      </div>
    </aside>
  );
}

function Timer({ deadline }: { deadline?: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  if (!deadline) {
    return <div className="text-sm text-[var(--muted)]">No timer</div>;
  }

  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <div className="text-sm text-[var(--muted)]">{seconds}s left</div>;
}

function ColorPicker({ onPick, onCancel }: { onPick: (color: Color) => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 p-4">
      <div className="panel grid w-full max-w-sm gap-4 p-5">
        <h2 className="text-xl font-black">Choose a color</h2>
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map((color) => (
            <button key={color} className={`button card-${color}`} onClick={() => onPick(color)}>
              {color}
            </button>
          ))}
        </div>
        <button className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function RoundPanel({ snapshot, send }: { snapshot: GameSnapshot; send: (type: string, payload?: unknown) => void }) {
  const me = snapshot.players.find((player) => player.id === snapshot.self?.id);
  const winner = snapshot.players.find((player) => player.id === (snapshot.gameWinnerId ?? snapshot.roundWinnerId));

  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
      <div>
        <div className="font-black">{snapshot.phase === "gameEnd" ? "Game finished" : "Round finished"}</div>
        <div className="text-sm text-[var(--muted)]">{winner ? `${winner.nickname} won.` : "Waiting for next round."}</div>
      </div>
      {snapshot.phase === "roundEnd" && me?.isHost ? (
        <button className="button" onClick={() => send("game.start")}>
          Start next round
        </button>
      ) : null}
    </div>
  );
}
