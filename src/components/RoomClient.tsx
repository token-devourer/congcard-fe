"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Client, Room } from "@colyseus/sdk";
import type { Card, Color, GameSnapshot, ParticipantRole, RoomSettings } from "@congcard/shared";
import { AVATARS } from "@congcard/shared";
import { anchorRef } from "@/lib/anchors";
import { resolveRoom } from "@/lib/api";
import { Avatar } from "./Avatar";
import { AvatarGrid } from "./AvatarGrid";
import { GAME_SERVER_URL } from "@/lib/config";
import { LOG_ICON, translateLog, type Translate } from "@/lib/log";
import { needsColor, playableCardInHand } from "@/lib/rules";
import { clearRoomSession, reconnectStorageKey, resumeStorageKey } from "@/lib/session";
import { useRoomStore } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { ChallengeModal } from "./ChallengeModal";
import { ColorPicker } from "./ColorPicker";
import { FlightLayer } from "./FlightLayer";
import { GameEventOverlay } from "./GameEventOverlay";
import { Hand } from "./Hand";
import { LanguageToggle } from "./LanguageToggle";
import { RoundEndOverlay } from "./RoundEndOverlay";
import { RoundTable } from "./RoundTable";
import { RulesModal } from "./RulesModal";
import { SoundToggle } from "./SoundToggle";
import { TurnBanner } from "./TurnBanner";
import { UnoButton } from "./UnoButton";
import { PingBadge } from "./PingBadge";
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
  const [showRules, setShowRules] = useState(false);

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
      const reconnectKey = reconnectStorageKey(code);
      const resumeKey = resumeStorageKey(code);
      const token = window.localStorage.getItem(reconnectKey);
      const resumeToken = window.localStorage.getItem(resumeKey) ?? undefined;
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
          avatarId,
          resumeToken
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
        if (nextSnapshot.self?.resumeToken) {
          window.localStorage.setItem(resumeKey, nextSnapshot.self.resumeToken);
        }
        setSnapshot(nextSnapshot);
      });
      room.onMessage("error", (payload: { code?: string; message?: string }) => {
        setError(payload.message ?? t("common.actionFailed"), payload.code);
      });

      const pingInterval = window.setInterval(() => {
        room.ping((ms: number) => room.send("room.ping", { ping: ms }));
      }, 2000);

      room.onLeave(() => {
        setStatus("closed");
        window.clearInterval(pingInterval);
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
    // Drop room session tokens so a later visit starts a fresh join.
    clearRoomSession(window.localStorage, code);
    roomRef.current?.leave();
    roomRef.current = null;
    router.push("/");
  }

  function leaveAndForget() {
    // Full session reset for the header leave button.
    clearRoomSession(window.localStorage, code);
    window.localStorage.removeItem("congcard:nickname");
    window.localStorage.removeItem("congcard:avatar");
    roomRef.current?.leave();
    roomRef.current = null;
    reset();
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

  const selfPlayer = snapshot?.players.find((player) => player.id === snapshot.self?.id);

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
          {selfPlayer ? (
            <button
              type="button"
              className={`rounded-full border px-3 py-1 font-bold transition-colors ${
                selfPlayer.away
                  ? "border-[var(--gold)] bg-[var(--gold)] text-black"
                  : "border-[var(--line)] text-[var(--text)] hover:border-[var(--gold)]"
              }`}
              onClick={() => send("room.setAway", { away: !selfPlayer.away })}
            >
              {selfPlayer.away ? t("room.return") : t("room.away")}
            </button>
          ) : null}
          <SoundToggle />
          <LanguageToggle />
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-3 py-1 text-[var(--text)] transition-colors hover:border-[var(--gold)]"
            onClick={() => setShowRules(true)}
          >
            {t("room.rules")}
          </button>
          <button
            type="button"
            className="rounded-full border border-red-400/40 px-3 py-1 font-bold text-red-200 transition-colors hover:border-red-400 hover:text-red-100"
            onClick={leaveAndForget}
            title={t("room.leaveHint")}
          >
            {t("room.leave")}
          </button>
        </div>
      </header>

      <ErrorToast />

      <RulesModal open={showRules} onClose={() => setShowRules(false)} settings={snapshot?.settings} />

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
  deck_boxes_too_low: "errors.deckBoxesTooLow",
  one_call_pending: "errors.oneCallPending",
  one_window_active: "errors.oneWindowActive",
  stack_required: "errors.stackRequired",
  player_not_found: "errors.playerNotFound",
  player_away: "errors.playerAway",
  game_paused: "errors.gamePaused",
  invalid_room_code: "errors.invalidRoomCode",
  rate_limited: "errors.rateLimited"
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

export function Lobby({
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
  const deckBoxMinimum = Math.max(1, Math.ceil(snapshot.players.length / 4));
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
            <button className="button !min-h-9 !px-3 text-sm" disabled={me?.away} onClick={() => send("room.ready", { ready: !me?.ready })}>
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
                      {player.connected && player.ping > 0 ? <PingBadge ping={player.ping} /> : null}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      <span className={player.ready ? "font-bold text-green-300" : ""}>
                        {player.ready ? `✓ ${t("lobby.statusReady")}` : t("lobby.statusWaiting")}
                      </span>
                      <span>·</span>
                      <span className={!player.connected ? "text-red-300" : player.away ? "text-[var(--gold)]" : ""}>
                        {!player.connected ? t("lobby.offline") : player.away ? t("lobby.away") : t("lobby.online")}
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
          <span className="text-sm font-bold text-[var(--muted)]">{t("lobby.gameMode")}</span>
          <select className="field" disabled={!isHost} value={snapshot.settings.modeId} onChange={() => updateSetting({ modeId: "standard" })}>
            <option value="standard">{t("lobby.modeStandard")}</option>
            <option value="zero-seven" disabled>{t("lobby.modeZeroSeven")}</option>
            <option value="explode-25" disabled>{t("lobby.modeExplode")}</option>
            <option value="flip" disabled>{t("lobby.modeFlip")}</option>
          </select>
        </label>
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
            onChange={(event) => {
              const value = event.target.value;
              updateSetting({
                scoreTarget: value === "lastStand" ? "lastStand" : (Number(value) as RoomSettings["scoreTarget"])
              });
            }}
          >
            <option value={0}>{t("lobby.oneRound")}</option>
            <option value={500}>{t("lobby.points500")}</option>
            <option value="lastStand">{t("lobby.lastStand")}</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[var(--muted)]">{t("lobby.deckBoxes")}</span>
          <select
            className="field"
            disabled={!isHost}
            value={Math.max(snapshot.settings.deckBoxes, deckBoxMinimum)}
            onChange={(event) => updateSetting({ deckBoxes: Number(event.target.value) })}
          >
            {Array.from({ length: 6 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value} disabled={value < deckBoxMinimum}>
                {t("lobby.deckBoxOption", { count: value })}
              </option>
            ))}
          </select>
          <span className="text-xs leading-snug text-[var(--muted)]">{t("lobby.deckBoxesHint", { count: deckBoxMinimum })}</span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
            disabled={!isHost}
            checked={snapshot.settings.allowMidGameJoin}
            onChange={(event) => updateSetting({ allowMidGameJoin: event.target.checked })}
          />
          <span className="grid gap-1">
            <span className="text-sm font-bold text-[var(--text)]">{t("lobby.allowMidGameJoin")}</span>
            <span className="text-xs leading-snug text-[var(--muted)]">{t("lobby.allowMidGameJoinHint")}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
            disabled={!isHost}
            checked={snapshot.settings.jumpInEnabled}
            onChange={(event) => updateSetting({ jumpInEnabled: event.target.checked })}
          />
          <span className="grid gap-1">
            <span className="text-sm font-bold text-[var(--text)]">{t("lobby.jumpIn")}</span>
            <span className="text-xs leading-snug text-[var(--muted)]">{t("lobby.jumpInHint")}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
            disabled={!isHost}
            checked={snapshot.settings.stackingEnabled}
            onChange={(event) => updateSetting({ stackingEnabled: event.target.checked })}
          />
          <span className="grid gap-1">
            <span className="text-sm font-bold text-[var(--text)]">{t("lobby.stacking")}</span>
            <span className="text-xs leading-snug text-[var(--muted)]">{t("lobby.stackingHint")}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
            disabled={!isHost}
            checked={snapshot.settings.challengeEnabled}
            onChange={(event) => updateSetting({ challengeEnabled: event.target.checked })}
          />
          <span className="grid gap-1">
            <span className="text-sm font-bold text-[var(--text)]">{t("lobby.challenge")}</span>
            <span className="text-xs leading-snug text-[var(--muted)]">{t("lobby.challengeHint")}</span>
          </span>
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
  const eventLockUntil = useRoomStore((state) => state.eventLockUntil);
  const now = useNow(100);
  const selfRole = snapshot.self?.role ?? "spectator";
  const isPlayer = selfRole === "player";
  const me = isPlayer ? snapshot.players.find((player) => player.id === snapshot.self?.id) : undefined;
  const finished = Boolean(me?.finishedRank);
  const playerAway = Boolean(me?.away);
  const paused = Boolean(snapshot.pauseReason);
  const isMyTurn =
    isPlayer && !finished && !playerAway && !paused && snapshot.phase === "playing" && snapshot.currentPlayerId === snapshot.self?.id && !snapshot.pendingChallenge;
  const eventLocked = now < eventLockUntil;
  const actionLocked = Boolean(snapshot.oneWindow) || eventLocked || playerAway || paused;
  const canCallOne =
    isPlayer &&
    !finished &&
    !playerAway &&
    !eventLocked &&
    snapshot.oneWindow?.playerId === snapshot.self?.id &&
    snapshot.self?.hand.length === 1 &&
    !me?.calledOne;
  const canDraw = isMyTurn && !snapshot.pendingStack && !snapshot.self?.drawnCardId && !actionLocked;
  const oneTarget =
    isPlayer && !finished && !playerAway && !eventLocked && snapshot.oneWindow && snapshot.oneWindow.playerId !== me?.id
      ? snapshot.players.find((player) => player.id === snapshot.oneWindow?.playerId && player.cardCount === 1 && !player.calledOne)
      : undefined;

  useEffect(() => {
    if (!isPlayer || finished || playerAway || (selectedCard && !playableCardInHand(snapshot, selectedCard))) {
      setSelectedCard(null);
    }
  }, [finished, isPlayer, playerAway, selectedCard, setSelectedCard, snapshot]);

  function play(card: Card) {
    if (!isPlayer || finished || playerAway || eventLocked) {
      return;
    }

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
    if (eventLocked || playerAway) {
      return;
    }

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
          {paused ? <PauseBanner /> : null}
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
            {isPlayer && !finished ? (
              <>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{t("board.yourHand")}</span>
                  <span className="text-xs font-bold text-[var(--muted)]">
                {t("board.cards", { count: snapshot.self?.hand.length ?? 0 })} · {t("board.points", { score: me?.score ?? 0 })}
                  </span>
                </div>
                <Hand
                  snapshot={snapshot}
                  isMyTurn={isMyTurn}
                  actionLocked={actionLocked}
                  onPlay={play}
                  onPassDrawn={() => send("game.playDrawn", { play: false })}
                />
              </>
            ) : (
              <ViewerStatus snapshot={snapshot} role={finished ? "spectator" : selfRole} finishedRank={me?.finishedRank} />
            )}
          </div>
        </div>
      </section>

      <FlightLayer />
      <TurnBanner isMyTurn={isMyTurn} />
      <GameEventOverlay />
      {isPlayer && !finished && !playerAway && !paused ? <ChallengeModal snapshot={snapshot} send={send} actionLocked={eventLocked} /> : null}
      <RoundEndOverlay snapshot={snapshot} send={send} onLeave={onLeave} />
      <AnimatePresence>
        {selectedCard ? <ColorPicker disabled={eventLocked} onPick={chooseColor} onCancel={() => setSelectedCard(null)} /> : null}
      </AnimatePresence>
    </>
  );
}

function PauseBanner() {
  const t = useTranslations();

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex justify-center">
      <div className="panel max-w-md border-[var(--gold)]/70 bg-[#1f1a0a]/90 px-4 py-3 text-center shadow-[0_0_28px_rgba(242,193,78,0.25)]">
        <div className="display text-base font-black text-[var(--gold)]">{t("board.paused")}</div>
        <div className="mt-1 text-xs font-bold text-[var(--muted)]">{t("board.pausedHint")}</div>
      </div>
    </div>
  );
}

function ViewerStatus({ snapshot, role, finishedRank }: { snapshot: GameSnapshot; role: ParticipantRole; finishedRank?: number }) {
  const t = useTranslations();
  const statusKey = finishedRank ? "board.finishedRound" : role === "waiting" ? "board.waitingNextRound" : "board.spectatingOnly";
  const viewers = snapshot.viewers ?? [];

  return (
    <div className="grid gap-3 p-2">
      <div className="rounded-xl border border-[var(--gold)]/35 bg-[var(--gold)]/10 p-4 text-center">
        <p className="display text-lg font-black text-[var(--gold)]">
          {finishedRank ? t(statusKey, { rank: finishedRank }) : t(statusKey)}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("board.readOnlyView")}</p>
      </div>

      <div className="rounded-xl bg-black/25 p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          <span>{t("board.scoreboard")}</span>
          <span>{t("board.viewersCount", { count: viewers.length })}</span>
        </div>
        <div className="grid gap-1.5">
          {[...snapshot.players].sort((a, b) => b.score - a.score).map((player) => (
            <div key={player.id} className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar avatarId={player.avatarId} size={24} />
                <span className="truncate font-bold">{player.nickname}</span>
                {!player.connected ? <span className="text-xs text-red-300">{t("lobby.offline")}</span> : null}
                {player.connected && player.away ? <span className="text-xs text-[var(--gold)]">{t("lobby.away")}</span> : null}
                {player.autoPlay ? <span className="text-xs text-[var(--gold)]">{t("board.autoPlay")}</span> : null}
                  </span>
              <span className="tabular-nums text-[var(--muted)]">{player.score}</span>
                </div>
          ))}
        </div>
      </div>

      {viewers.length > 0 ? (
        <div className="rounded-xl bg-black/25 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{t("board.viewers")}</div>
          <div className="grid gap-1.5">
            {viewers.map((viewer) => (
              <div key={viewer.id} className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar avatarId={viewer.avatarId} size={22} />
                  <span className="truncate font-bold">{viewer.nickname}</span>
                </span>
                <span className={viewer.role === "waiting" ? "text-[var(--gold)]" : "text-[var(--muted)]"}>
                  {t(`board.roles.${viewer.role}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
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
