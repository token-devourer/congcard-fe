"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Client, Room } from "@colyseus/sdk";
import type { Card, Color, GameSnapshot, RoomSettings } from "@congcard/shared";
import { AVATARS } from "@congcard/shared";
import { anchorRef } from "@/lib/anchors";
import { resolveRoom } from "@/lib/api";
import { Avatar } from "./Avatar";
import { AvatarGrid } from "./AvatarGrid";
import { GAME_SERVER_URL } from "@/lib/config";
import { LOG_ICON, translateLog, type Translate } from "@/lib/log";
import { needsColor, playableCardInHand } from "@/lib/rules";
import { useRoomStore } from "@/lib/store";
import { ChallengeModal } from "./ChallengeModal";
import { ColorPicker } from "./ColorPicker";
import { FlightLayer } from "./FlightLayer";
import { GameEventOverlay } from "./GameEventOverlay";
import { Hand } from "./Hand";
import { LanguageToggle } from "./LanguageToggle";
import { RoundEndOverlay } from "./RoundEndOverlay";
import { RoundTable } from "./RoundTable";
import { SoundToggle } from "./SoundToggle";
import { TurnBanner } from "./TurnBanner";
import { UnoButton } from "./UnoButton";
import { unlockSound } from "@/lib/sound";

interface RoomClientProps {
  code: string;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "closed";

export function RoomClient({ code }: RoomClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const roomRef = useRef<Room | null>(null);
  const connectingRef = useRef(false);
  const { snapshot, setSnapshot, setError, reset } = useRoomStore();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  // nickname is only set once confirmed (saved profile or submitted form);
  // draftNickname holds form input so typing does not auto-join the room.
  const [nickname, setNickname] = useState("");
  const [draftNickname, setDraftNickname] = useState("");
  const [avatarId, setAvatarId] = useState<(typeof AVATARS)[number]>("sun");
  const [profileReady, setProfileReady] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  useEffect(() => {
    const savedName = window.localStorage.getItem("congcard:nickname");
    const savedAvatar = window.localStorage.getItem("congcard:avatar");
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

  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!nickname.trim() || connectingRef.current || roomRef.current) {
      return;
    }

    connectingRef.current = true;
    setStatus("connecting");
    setError("");

    try {
      const client = new Client(GAME_SERVER_URL);
      const reconnectKey = `congcard:reconnect:${code}`;
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
        const lookup = await resolveRoom(code);
        room = await client.joinById(lookup.roomId, {
          nickname: nickname.trim(),
          avatarId
        });
      }

      roomRef.current = room;
      setStatus("connected");
      window.localStorage.setItem("congcard:nickname", nickname.trim());
      window.localStorage.setItem("congcard:avatar", avatarId);
      if (room.reconnectionToken) {
        window.localStorage.setItem(reconnectKey, room.reconnectionToken);
      }

      room.onMessage("state", (nextSnapshot: GameSnapshot) => {
        setSnapshot(nextSnapshot);
      });
      room.onMessage("error", (payload: { code?: string; message?: string }) => {
        setError(payload.message ?? t("common.actionFailed"), payload.code);
      });
      room.onLeave(() => {
        setStatus("closed");
        roomRef.current = null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("landing.connectionFailed"));
      setStatus("closed");
    } finally {
      connectingRef.current = false;
    }
  }, [avatarId, code, nickname, setError, setSnapshot, t]);

  useEffect(() => {
    if (profileReady && nickname.trim()) {
      void connect();
    }
  }, [connect, nickname, profileReady]);

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftNickname.trim();
    if (name) {
      setNickname(name);
    }
  }

  function send(type: string, payload?: unknown) {
    unlockSound();
    setError("");
    roomRef.current?.send(type, payload);
  }

  function leaveToHome() {
    // Drop the reconnect token so coming back to this URL asks for a fresh
    // join instead of silently rejoining the finished game.
    window.localStorage.removeItem(`congcard:reconnect:${code}`);
    roomRef.current?.leave();
    roomRef.current = null;
    router.push("/");
  }

  if (!profileReady) {
    return null;
  }

  if (!nickname.trim()) {
    return (
      <main className="app-shell grid min-h-screen place-items-center py-8">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel grid w-full max-w-md gap-4 p-5"
          onSubmit={submitProfile}
        >
          <div>
            <p className="display text-sm font-black uppercase tracking-[0.18em] text-[var(--gold)]">
              {t("room.title", { code })}
            </p>
            <h1 className="display mt-2 text-2xl font-black">{t("room.chooseSeatName")}</h1>
          </div>
          <input
            className="field"
            value={draftNickname}
            onChange={(event) => setDraftNickname(event.target.value)}
            maxLength={20}
            placeholder={t("landing.nicknamePlaceholder")}
          />
          <AvatarGrid value={avatarId} onChange={setAvatarId} />
          <button className="button" disabled={!draftNickname.trim() || status === "connecting"}>
            {t("room.join")}
          </button>
        </motion.form>
      </main>
    );
  }

  return (
    <main className="app-shell py-3 md:py-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/icon.svg" alt="" className="h-11 w-11 rounded-xl" />
          <div className="min-w-0">
            <p className="display text-sm font-black uppercase tracking-[0.18em] text-[var(--gold)]">{t("common.appName")}</p>
            <h1 className="display text-2xl font-black">{t("room.title", { code })}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span
            className={`flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1 ${
              status === "closed" ? "text-red-300" : ""
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                status === "connected" ? "bg-green-400" : status === "connecting" ? "animate-pulse bg-[var(--gold)]" : "bg-red-400"
              }`}
            />
            {t(`room.status.${status}`)}
          </span>
          <SoundToggle />
          <LanguageToggle />
          <a className="rounded-full border border-[var(--line)] px-3 py-1 text-[var(--text)]" href="/rules">
            {t("room.rules")}
          </a>
        </div>
      </header>

      <ErrorToast />

      {!snapshot ? (
        <div className="panel grid min-h-[420px] place-items-center p-6 text-[var(--muted)]">{t("room.connecting")}</div>
      ) : snapshot.phase === "lobby" ? (
        <Lobby snapshot={snapshot} code={code} send={send} />
      ) : (
        <Board snapshot={snapshot} send={send} onLeave={leaveToHome} selectedCard={selectedCard} setSelectedCard={setSelectedCard} />
      )}
    </main>
  );
}

// Server error codes that have a friendlier, localized phrasing than the raw
// English message sent over the wire.
const ERROR_MESSAGE_KEYS: Record<string, string> = {
  not_your_turn: "errors.notYourTurn",
  invalid_card: "errors.invalidCard",
  drawn_card_only: "errors.drawnCardOnly",
  already_drew: "errors.alreadyDrew",
  color_required: "errors.colorRequired",
  cannot_call_one: "errors.cannotCallOne",
  catch_failed: "errors.catchFailed",
  pending_challenge: "errors.pendingChallenge",
  empty_deck: "errors.emptyDeck",
  not_host: "errors.notHost",
  room_full: "errors.roomFull",
  game_in_progress: "errors.gameInProgress",
  game_finished: "errors.gameFinished",
  max_players_too_low: "errors.maxPlayersTooLow",
  one_call_pending: "errors.oneCallPending"
};

// Floating toast instead of an in-flow banner: it never pushes the board
// around, dismisses itself, and translates known server error codes.
function ErrorToast() {
  const t = useTranslations();
  const error = useRoomStore((state) => state.error);
  const setError = useRoomStore((state) => state.setError);

  useEffect(() => {
    if (!error) {
      return undefined;
    }

    const id = window.setTimeout(() => setError(""), 3500);
    return () => window.clearTimeout(id);
  }, [error, setError]);

  const messageKey = error?.code ? ERROR_MESSAGE_KEYS[error.code] : undefined;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-4">
      <AnimatePresence>
        {error ? (
          <motion.div
            key={error.id}
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="shake flex max-w-[92vw] items-center gap-2 rounded-full border border-red-400/45 bg-[#33100b]/95 px-4 py-2 text-sm font-bold text-red-100 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm"
            role="alert"
          >
            <span aria-hidden="true">⚠️</span>
            <span className="min-w-0 truncate">{messageKey ? t(messageKey) : error.message}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Lobby({
  snapshot,
  code,
  send
}: {
  snapshot: GameSnapshot;
  code: string;
  send: (type: string, payload?: unknown) => void;
}) {
  const t = useTranslations();
  const me = snapshot.players.find((player) => player.id === snapshot.self?.id);
  const isHost = Boolean(me?.isHost);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  function updateSetting(input: Partial<RoomSettings>) {
    send("room.updateSettings", input);
  }

  async function copy(kind: "code" | "link") {
    const value = kind === "code" ? code : window.location.href;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable (insecure context), ignore
    }
  }

  return (
    <section className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-xl font-black">{t("lobby.players")}</h2>
          <div className="flex flex-wrap gap-2">
            <button className="button secondary !min-h-9 !px-3 text-sm" onClick={() => copy("code")}>
              {copied === "code" ? t("lobby.copied") : `📋 ${t("lobby.copyCode")}`}
            </button>
            <button className="button secondary !min-h-9 !px-3 text-sm" onClick={() => copy("link")}>
              {copied === "link" ? t("lobby.copied") : `🔗 ${t("lobby.copyLink")}`}
            </button>
            <button className="button !min-h-9 !px-3 text-sm" onClick={() => send("room.ready", { ready: !me?.ready })}>
              {me?.ready ? t("lobby.notReady") : t("lobby.ready")}
            </button>
          </div>
        </div>
        <div className="grid gap-3">
          <AnimatePresence initial={false}>
            {snapshot.players.map((player) => (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar avatarId={player.avatarId} size={44} className="flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-black">
                      {player.isHost ? "👑 " : ""}
                      {player.nickname}
                      {player.id === snapshot.self?.id ? <span className="text-[var(--gold)]"> ★</span> : null}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      <span className={player.ready ? "font-bold text-green-300" : ""}>
                        {player.ready ? `✓ ${t("lobby.statusReady")}` : t("lobby.statusWaiting")}
                      </span>
                      <span>·</span>
                      <span className={player.connected ? "" : "text-red-300"}>
                        {player.connected ? t("lobby.online") : t("lobby.offline")}
                      </span>
                    </div>
                  </div>
                </div>
                {isHost && !player.isHost ? (
                  <button className="button danger !min-h-9 !px-3 text-sm" onClick={() => send("room.kick", { playerId: player.id })}>
                    {t("lobby.kick")}
                  </button>
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <aside className="panel grid content-start gap-4 p-4">
        <h2 className="display text-xl font-black">{t("lobby.settings")}</h2>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[var(--muted)]">{t("lobby.maxPlayers")}</span>
          <select
            className="field"
            disabled={!isHost}
            value={snapshot.settings.maxPlayers}
            onChange={(event) => updateSetting({ maxPlayers: Number(event.target.value) })}
          >
            {Array.from({ length: 9 }, (_, index) => index + 2).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[var(--muted)]">{t("lobby.turnTimer")}</span>
          <select
            className="field"
            disabled={!isHost}
            value={snapshot.settings.turnTimeoutSec}
            onChange={(event) => updateSetting({ turnTimeoutSec: Number(event.target.value) })}
          >
            {[15, 30, 45, 60].map((value) => (
              <option key={value} value={value}>
                {t("lobby.seconds", { value })}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[var(--muted)]">{t("lobby.scoreTarget")}</span>
          <select
            className="field"
            disabled={!isHost}
            value={snapshot.settings.scoreTarget}
            onChange={(event) => updateSetting({ scoreTarget: Number(event.target.value) as RoomSettings["scoreTarget"] })}
          >
            <option value={0}>{t("lobby.oneRound")}</option>
            <option value={500}>{t("lobby.points500")}</option>
          </select>
        </label>
        {isHost ? (
          <button className="button" disabled={snapshot.players.length < 2} onClick={() => send("game.start")}>
            {snapshot.players.length < 2 ? t("lobby.needPlayers") : t("lobby.start")}
          </button>
        ) : (
          <p className="text-center text-sm text-[var(--muted)]">{t("lobby.waitingHost")}</p>
        )}
      </aside>
    </section>
  );
}

function Board({
  snapshot,
  send,
  onLeave,
  selectedCard,
  setSelectedCard
}: {
  snapshot: GameSnapshot;
  send: (type: string, payload?: unknown) => void;
  onLeave: () => void;
  selectedCard: Card | null;
  setSelectedCard: (card: Card | null) => void;
}) {
  const t = useTranslations();
  const me = snapshot.players.find((player) => player.id === snapshot.self?.id);
  const isMyTurn = snapshot.phase === "playing" && snapshot.currentPlayerId === snapshot.self?.id && !snapshot.pendingChallenge;
  const actionLocked = Boolean(snapshot.oneWindow?.callPending);
  const canCallOne = snapshot.oneWindow?.playerId === snapshot.self?.id && snapshot.self?.hand.length === 1 && !me?.calledOne;
  const canDraw = isMyTurn && !snapshot.self?.drawnCardId && !actionLocked;
  const oneTarget =
    snapshot.oneWindow && snapshot.oneWindow.playerId !== me?.id
      ? snapshot.players.find((player) => player.id === snapshot.oneWindow?.playerId && player.cardCount === 1 && !player.calledOne)
      : undefined;

  useEffect(() => {
    if (selectedCard && !playableCardInHand(snapshot, selectedCard)) {
      setSelectedCard(null);
    }
  }, [selectedCard, setSelectedCard, snapshot]);

  function play(card: Card) {
    const playable = playableCardInHand(snapshot, card);
    if (!playable) {
      return;
    }

    if (needsColor(playable)) {
      setSelectedCard(playable);
      return;
    }

    send("game.playCard", { cardId: playable.id });
  }

  function chooseColor(color: Color) {
    const playable = playableCardInHand(snapshot, selectedCard);
    if (!playable) {
      setSelectedCard(null);
      return;
    }

    send("game.playCard", { cardId: playable.id, declaredColor: color });
    setSelectedCard(null);
  }

  return (
    <>
      <section className="board">
        <div className="relative">
          <RoundTable snapshot={snapshot} isMyTurn={isMyTurn} canDraw={canDraw} onDraw={() => send("game.drawCard")} />
          <LogTicker snapshot={snapshot} />
        </div>

        <div className="relative">
          <UnoButton
            canCallOne={Boolean(canCallOne)}
            callWindow={
              canCallOne && snapshot.oneWindow
                ? {
                    opensAt: snapshot.oneWindow.opensAt,
                    deadline: snapshot.oneWindow.deadline,
                    callPending: snapshot.oneWindow.callPending,
                    callResolvesAt: snapshot.oneWindow.callResolvesAt
                  }
                : undefined
            }
            onCallOne={() => send("game.callOne")}
            catchTarget={
              oneTarget && snapshot.oneWindow
                ? {
                    id: oneTarget.id,
                    nickname: oneTarget.nickname,
                    opensAt: snapshot.oneWindow.opensAt,
                    deadline: snapshot.oneWindow.deadline,
                    callPending: snapshot.oneWindow.callPending,
                    callResolvesAt: snapshot.oneWindow.callResolvesAt
                  }
                : undefined
            }
            onCatch={(targetId) => send("game.catchOne", { targetId })}
          />
          <div
            ref={anchorRef("hand")}
            className={`panel p-3 transition-shadow duration-300 ${isMyTurn ? "my-turn-glow" : ""}`}
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{t("board.yourHand")}</span>
              <span className="text-xs font-bold text-[var(--muted)]">
                {t("board.cards", { count: snapshot.self?.hand.length ?? 0 })} · {t("board.points", { score: me?.score ?? 0 })}
              </span>
            </div>
            <Hand
              snapshot={snapshot}
              isMyTurn={isMyTurn}
              onPlay={play}
              onPassDrawn={() => send("game.playDrawn", { play: false })}
            />
          </div>
        </div>
      </section>

      <FlightLayer />
      <TurnBanner isMyTurn={isMyTurn} />
      <GameEventOverlay />
      <ChallengeModal snapshot={snapshot} send={send} />
      <RoundEndOverlay snapshot={snapshot} send={send} onLeave={onLeave} />
      <AnimatePresence>
        {selectedCard ? <ColorPicker onPick={chooseColor} onCancel={() => setSelectedCard(null)} /> : null}
      </AnimatePresence>
    </>
  );
}

function LogTicker({ snapshot }: { snapshot: GameSnapshot }) {
  const t = useTranslations();
  const entries = snapshot.actionLog.slice(-5);

  return (
    <aside className="absolute left-1 top-1 z-20 hidden w-60 rounded-xl bg-black/45 p-2.5 backdrop-blur-sm md:block">
      <h2 className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">{t("board.log")}</h2>
      <div className="grid gap-1 text-xs leading-snug">
        {entries.map((entry, index) => (
          <div
            key={entry.seq}
            className="flex items-start gap-1.5"
            style={{ opacity: 0.45 + 0.55 * ((index + 1) / entries.length) }}
          >
            <span aria-hidden="true">{LOG_ICON[entry.type] ?? "•"}</span>
            <span className="min-w-0 flex-1">{translateLog(entry.message, t as Translate)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
