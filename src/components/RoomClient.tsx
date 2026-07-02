"use client";

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Client, Room } from "@colyseus/sdk";
import type { Card, ChaosSelectableCard, Color, GameSnapshot, ParticipantRole, RoomSettings } from "@congcard/shared";
import { AVATARS } from "@congcard/shared";
import {
  Accessibility,
  Bot,
  Check,
  Copy,
  Eye,
  Gamepad2,
  Link2,
  List,
  Loader2,
  Monitor,
  Settings2,
  Sparkles,
  Trophy,
  X
} from "lucide-react";
import { anchorRef } from "@/lib/anchors";
import { resolveRoom } from "@/lib/api";
import { Avatar } from "./Avatar";
import { AvatarGrid } from "./AvatarGrid";
import { GAME_SERVER_URL } from "@/lib/config";
import { LOG_ICON, translateLog, type Translate } from "@/lib/log";
import { batchCardGroups } from "@/lib/batch";
import { cardText, isSelfColorHunt, jumpInCardInHand, needsColor, playableCardInHand } from "@/lib/rules";
import { isShortcutWindowOpen, resolveGameShortcut, shortcutKey, shouldIgnoreShortcut } from "@/lib/shortcuts";
import { clearRoomSession, reconnectStorageKey, resumeStorageKey } from "@/lib/session";
import { safeGet, safeRemove, safeSet, safeStorage } from "@/lib/storage";
import { useRoomStore } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { ChallengeModal } from "./ChallengeModal";
import { CardView } from "./CardView";
import { ColorPicker } from "./ColorPicker";
import { FlipTransitionLayer } from "./FlipTransitionLayer";
import { LanguageToggle } from "./LanguageToggle";
import { MusicLayer } from "./MusicLayer";
import { AudioControls } from "./AudioControls";
import { RoundEndOverlay } from "./RoundEndOverlay";
import { RoundDealBoard } from "./RoundDealBoard";
import { RulesModal } from "./RulesModal";
import { TurnBanner } from "./TurnBanner";
import { TurnAlertLayer } from "./TurnAlertLayer";
import { NotifyToggle } from "./NotifyToggle";
import { CardsModal } from "./CardsModal";
import { UnoButton } from "./UnoButton";
import { useGraphicsPreset } from "./AnimationProvider";
import type { BatchShortcutCommand } from "./BatchSelector";
import { PingBadge } from "./PingBadge";
import { unlockSound } from "@/lib/sound";

const FlightLayer = dynamic(() => import("./FlightLayer").then((m) => ({ default: m.FlightLayer })));
const GameEventOverlay = dynamic(() => import("./GameEventOverlay").then((m) => ({ default: m.GameEventOverlay })));
const Hand = dynamic(() => import("./Hand").then((m) => ({ default: m.Hand })));
const RoundTable = dynamic(() => import("./RoundTable").then((m) => ({ default: m.RoundTable })));

interface RoomClientProps {
  code: string;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "closed";

export function RoomClient({ code }: RoomClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const roomRef = useRef<Room | null>(null);
  const connectingRef = useRef(false);
  const pingIntervalRef = useRef<number | null>(null);
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
  const [showCards, setShowCards] = useState(false);
  const [localModeId, setLocalModeId] = useState<string | null>(null);

  useEffect(() => {
    const savedName = safeGet("congcard:nickname");
    const savedAvatar = safeGet("congcard:avatar");
    setNickname(savedName ?? "");
    if (savedAvatar && AVATARS.includes(savedAvatar as (typeof AVATARS)[number])) {
      setAvatarId(savedAvatar as (typeof AVATARS)[number]);
    }
    setProfileReady(true);

    return () => {
      if (pingIntervalRef.current) {
        window.clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
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

  useEffect(() => {
    const self = snapshot?.players.find((player) => player.id === snapshot.self?.id);
    if (snapshot?.phase !== "lobby" || !snapshot.settings.keyboardShortcutsEnabled || self?.away) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreShortcut(event)) return;
      const key = shortcutKey(event);
      if (key === "r" && !showRules) {
        event.preventDefault();
        setShowRules(true);
      } else if (key === "c" && !showCards) {
        event.preventDefault();
        setShowCards(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showRules, showCards, snapshot]);

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
      const token = safeGet(reconnectKey);
      const resumeToken = safeGet(resumeKey) ?? undefined;
      let room: Room | null = null;

      if (token) {
        try {
          room = await client.reconnect(token);
        } catch {
          safeRemove(reconnectKey);
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
      safeSet("congcard:nickname", nickname.trim());
      safeSet("congcard:avatar", avatarId);
      if (room.reconnectionToken) {
        safeSet(reconnectKey, room.reconnectionToken);
      }

      room.onMessage("state", (nextSnapshot: GameSnapshot) => {
        if (nextSnapshot.self?.resumeToken) {
          safeSet(resumeKey, nextSnapshot.self.resumeToken);
        }
        setSnapshot(nextSnapshot);
      });
      room.onMessage("error", (payload: { code?: string; message?: string }) => {
        setError(payload.message ?? t("common.actionFailed"), payload.code);
      });

      const pingInterval = window.setInterval(() => {
        if (!roomRef.current) {
          return;
        }
        room.ping((ms: number) => room.send("room.ping", { ping: ms }));
      }, 1000);
      pingIntervalRef.current = pingInterval;

      room.onLeave(() => {
        setStatus("closed");
        if (pingIntervalRef.current) {
          window.clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
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
    clearRoomSession(safeStorage, code);
    roomRef.current?.leave();
    roomRef.current = null;
    router.push("/");
  }

  function leaveAndForget() {
    // Full session reset for the header leave button.
    clearRoomSession(safeStorage, code);
    safeRemove("congcard:nickname");
    safeRemove("congcard:avatar");
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
    <main className={`app-shell py-3 md:py-5 ${snapshot?.settings.modeId === "flip" ? `flip-${snapshot.flipSide ?? "light"}` : ""}`}>
      <MusicLayer snapshot={snapshot} />
      {snapshot ? <FlipTransitionLayer snapshot={snapshot} /> : null}
      <header className="room-header mb-3">
        <div className="room-title-row">
          <img src="/icon.svg" alt="" className="h-11 w-11 rounded-xl" />
          <div className="min-w-0">
            <p className="display text-sm font-black uppercase tracking-[0.18em] text-[var(--gold)]">{t("common.appName")}</p>
            <h1 className="display text-2xl font-black leading-tight">{t("room.title", { code })}</h1>
          </div>
        </div>
        <div className="room-toolbar">
          <span
            className={`toolbar-pill ${
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
              className={`toolbar-pill font-bold transition-colors ${
                selfPlayer.away
                  ? "border-[var(--gold)] bg-[var(--gold)] text-black"
                  : "border-[var(--line)] text-[var(--text)] hover:border-[var(--gold)]"
              }`}
              onClick={() => send("room.setAway", { away: !selfPlayer.away })}
            >
              {selfPlayer.away ? t("room.return") : t("room.away")}
            </button>
          ) : null}
          <AudioControls />
          <NotifyToggle />
          <LanguageToggle />
          <button
            type="button"
            className="toolbar-pill text-[var(--text)] transition-colors hover:border-[var(--gold)]"
            onClick={() => setShowRules(true)}
            aria-keyshortcuts="R"
          >
            {t("room.rules")}
          </button>
          <button
            type="button"
            className="toolbar-pill text-[var(--text)] transition-colors hover:border-[var(--gold)]"
            onClick={() => setShowCards(true)}
          >
            {t("room.cards")}
          </button>
          <button
            type="button"
            className="toolbar-pill border-red-400/40 font-bold text-red-200 transition-colors hover:border-red-400 hover:text-red-100"
            onClick={leaveAndForget}
            title={t("room.leaveHint")}
          >
            {t("room.leave")}
          </button>
        </div>
      </header>

      <ErrorToast />

      <RulesModal open={showRules} onClose={() => setShowRules(false)} settings={snapshot?.settings} />
      <CardsModal key={localModeId || snapshot?.settings.modeId || "standard"} open={showCards} onClose={() => setShowCards(false)} modeId={localModeId || snapshot?.settings.modeId || "standard"} />

      {!snapshot ? (
        <div className="panel grid min-h-[420px] place-items-center p-6 text-[var(--muted)]">{t("room.connecting")}</div>
      ) : snapshot.phase === "lobby" ? (
        <Lobby snapshot={snapshot} code={code} send={send} localModeId={localModeId} setLocalModeId={setLocalModeId} />
      ) : snapshot.phase === "dealing" ? (
        <RoundDealBoard snapshot={snapshot} send={send} />
      ) : (
        <Board
          snapshot={snapshot}
          send={send}
          onLeave={leaveToHome}
          selectedCard={selectedCard}
          setSelectedCard={setSelectedCard}
          rulesOpen={showRules}
          onOpenRules={() => setShowRules(true)}
        />
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
  batch_disabled: "errors.batchDisabled",
  invalid_batch: "errors.invalidBatch",
  batch_after_draw: "errors.batchAfterDraw",
  batch_in_progress: "errors.batchInProgress",
  not_dealer: "errors.notDealer",
  deal_unavailable: "errors.dealUnavailable",
  shuffle_unavailable: "errors.shuffleUnavailable",
  hand_ready: "errors.handReady",
  not_dealing: "errors.notDealing",
  round_setup_active: "errors.roundSetupActive",
  draw_in_progress: "errors.drawInProgress",
  color_draw_unavailable: "errors.colorDrawUnavailable",
  chaos_pending: "errors.chaosPending",
  nuke_blocked_card: "errors.nukeBlockedCard",
  no_chaos_choice: "errors.noChaosChoice",
  no_chaos_card_choice: "errors.noChaosChoice",
  not_chaos_chooser: "errors.notChaosChooser",
  invalid_chaos_target: "errors.invalidChaosTarget",
  invalid_chaos_card: "errors.invalidChaosCard",
  inactive_chaos_card: "errors.inactiveChaosCard",
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

function SettingsSection({
  title,
  icon,
  children,
  open = false
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="settings-section" open={open}>
      <summary>
        <span className="settings-section-icon" aria-hidden="true">{icon}</span>
        <span>{title}</span>
        <span className="settings-section-chevron" aria-hidden="true" />
      </summary>
      <div className="settings-section-body">{children}</div>
    </details>
  );
}

export function Lobby({
  snapshot,
  code,
  send,
  localModeId,
  setLocalModeId
}: {
  snapshot: GameSnapshot;
  code: string;
  send: (type: string, payload?: unknown) => void;
  localModeId: string | null;
  setLocalModeId: (v: string | null) => void;
}) {
  const t = useTranslations();
  const me = snapshot.players.find((player) => player.id === snapshot.self?.id);
  const isHost = Boolean(me?.isHost);
  const visibleModeId = (localModeId || snapshot.settings.modeId) as RoomSettings["modeId"];
  const deckBoxMinimum = Math.max(visibleModeId === "chaos" ? 2 : 1, Math.ceil(snapshot.players.length / 4));
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const { tier, setTier, autoDetected } = useGraphicsPreset();

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
    <section className="lobby-layout">
      <div className="surface lobby-players-panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-label">{t("room.title", { code })}</p>
            <h2 className="display mt-1 text-xl font-black">{t("lobby.players")}</h2>
          </div>
          <div className="lobby-actions">
            <button className="button secondary !min-h-9 !px-3 text-sm" onClick={() => copy("code")}>
              {copied === "code" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied === "code" ? t("lobby.copied") : `📋 ${t("lobby.copyCode")}`}
            </button>
            <button className="button secondary !min-h-9 !px-3 text-sm" onClick={() => copy("link")}>
              {copied === "link" ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
              {copied === "link" ? t("lobby.copied") : `🔗 ${t("lobby.copyLink")}`}
            </button>
            <button className="button !min-h-9 !px-3 text-sm" disabled={me?.away} onClick={() => send("room.ready", { ready: !me?.ready })}>
              <Check size={16} aria-hidden="true" />
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
                className={`lobby-player-row ${player.ready ? "is-ready" : ""}`}
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

      <aside className="surface lobby-settings-panel premium-scroll">
        <div className="lobby-settings-heading">
          <Settings2 size={18} aria-hidden="true" />
          <div>
            <p className="section-label">{isHost ? t("lobby.host") : t("lobby.statusWaiting")}</p>
            <h2 className="display mt-1 text-xl font-black">{t("lobby.settings")}</h2>
          </div>
        </div>
        <SettingsSection title={t("lobby.sectionBasics")} icon={<Gamepad2 size={17} />} open>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[var(--muted)]">{t("lobby.gameMode")}</span>
          <select className="field" disabled={!isHost} value={localModeId || snapshot.settings.modeId} onChange={(event) => {
            const val = event.target.value as RoomSettings["modeId"];
            setLocalModeId(val === snapshot.settings.modeId ? null : val);
            updateSetting({
              modeId: val,
              callEnabled: val !== "chaos" && snapshot.settings.scoreTarget !== "lastStand",
              deckBoxes: Math.max(snapshot.settings.deckBoxes, val === "chaos" ? 2 : deckBoxMinimum)
            });
          }}>
            <option value="standard">{t("lobby.modeStandard")}</option>
            <option value="zero-seven" disabled>{t("lobby.modeZeroSeven")}</option>
            <option value="chaos">{t("lobby.modeChaos")}</option>
            <option value="flip">{t("lobby.modeFlip")}</option>
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
        </SettingsSection>
        <SettingsSection title={t("lobby.sectionAutomation")} icon={<Bot size={17} />}>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[var(--muted)]">{t("lobby.absentPlayerAction")}</span>
          <select
            className="field"
            disabled={!isHost}
            value={snapshot.settings.absentPlayerAction}
            onChange={(event) => updateSetting({ absentPlayerAction: event.target.value as RoomSettings["absentPlayerAction"] })}
          >
            <option value="none">{t("lobby.absentDoNothing")}</option>
            <option value="draw">{t("lobby.absentDraw")}</option>
            <option value="autoplay">{t("lobby.absentAutoplay")}</option>
          </select>
          <span className="text-xs leading-snug text-[var(--muted)]">{t(`lobby.absentHints.${snapshot.settings.absentPlayerAction}`)}</span>
        </label>
        {snapshot.settings.absentPlayerAction === "autoplay" ? (
          <label className="setting-card flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--gold)]"
              disabled={!isHost}
              checked={snapshot.settings.autoPlayCallOne}
              onChange={(event) => updateSetting({ autoPlayCallOne: event.target.checked })}
            />
            <span className="grid gap-1">
              <span className="text-sm font-bold text-[var(--text)]">{t("lobby.autoPlayCallOne")}</span>
              <span className="text-xs leading-snug text-[var(--muted)]">{t("lobby.autoPlayCallOneHint")}</span>
            </span>
          </label>
        ) : null}
        </SettingsSection>
        <SettingsSection title={t("lobby.sectionRules")} icon={<Sparkles size={17} />} open>
        <label className="grid gap-2">
          <span className="text-sm font-bold text-[var(--muted)]">{t("lobby.scoreTarget")}</span>
          <select
            className="field"
            disabled={!isHost}
            value={snapshot.settings.scoreTarget}
            onChange={(event) => {
              const value = event.target.value;
              const scoreTarget = value === "lastStand" ? "lastStand" : (Number(value) as RoomSettings["scoreTarget"]);
              updateSetting({
                scoreTarget,
                callEnabled: scoreTarget !== "lastStand"
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
          <span className="text-xs leading-snug text-[var(--muted)]">
            {t(snapshot.settings.modeId === "flip" ? "lobby.deckBoxesHintFlip" : "lobby.deckBoxesHint", { count: deckBoxMinimum })}
          </span>
        </label>
        <label className="setting-card flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
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
        <label className="setting-card flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
            disabled={!isHost}
            checked={snapshot.settings.batchEnabled}
            onChange={(event) => updateSetting({ batchEnabled: event.target.checked })}
          />
          <span className="grid gap-1">
            <span className="text-sm font-bold text-[var(--text)]">{t("lobby.batch")}</span>
            <span className="text-xs leading-snug text-[var(--muted)]">{t("lobby.batchHint")}</span>
          </span>
        </label>
        <label className="setting-card flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
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
        <label className="setting-card flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
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
        <label className="setting-card flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
            disabled={!isHost}
            checked={snapshot.settings.challengeEnabled}
            onChange={(event) => updateSetting({ challengeEnabled: event.target.checked })}
          />
          <span className="grid gap-1">
            <span className="text-sm font-bold text-[var(--text)]">{t(snapshot.settings.modeId === "flip" ? "lobby.challengeFlip" : "lobby.challenge")}</span>
            <span className="text-xs leading-snug text-[var(--muted)]">{t(snapshot.settings.modeId === "flip" ? "lobby.challengeFlipHint" : "lobby.challengeHint")}</span>
          </span>
        </label>
        <label className="setting-card flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
            disabled={!isHost}
            checked={snapshot.settings.callEnabled}
            onChange={(event) => updateSetting({ callEnabled: event.target.checked })}
          />
          <span className="grid gap-1">
            <span className="text-sm font-bold text-[var(--text)]">{t("lobby.call")}</span>
            <span className="text-xs leading-snug text-[var(--muted)]">{t("lobby.callHint")}</span>
          </span>
        </label>
        </SettingsSection>
        <SettingsSection title={t("lobby.sectionControls")} icon={<Accessibility size={17} />}>
        <label className="setting-card flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--gold)]"
            disabled={!isHost}
            checked={snapshot.settings.keyboardShortcutsEnabled}
            onChange={(event) => updateSetting({ keyboardShortcutsEnabled: event.target.checked })}
          />
          <span className="grid gap-1">
            <span className="text-sm font-bold text-[var(--text)]">{t("lobby.keyboardShortcuts")}</span>
            <span className="text-xs leading-snug text-[var(--muted)]">{t("lobby.keyboardShortcutsHint")}</span>
          </span>
        </label>
        </SettingsSection>
        <SettingsSection title={t("lobby.sectionGraphics")} icon={<Monitor size={17} />}>
        <label className="setting-card flex items-start gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
          <span className="grid gap-1">
            <span className="text-sm font-bold text-[var(--text)]">{t("lobby.graphicsQuality")}</span>
            <span className="text-xs leading-snug text-[var(--muted)]">{autoDetected ? t("lobby.graphicsAuto") : ""}</span>
          </span>
          <select
            className="field ml-auto w-auto min-w-[100px]"
            value={tier}
            onChange={(event) => setTier(event.target.value as "high" | "low")}
          >
            <option value="high">{t("lobby.graphicsHigh")}</option>
            <option value="low">{t("lobby.graphicsLow")}</option>
          </select>
        </label>
        </SettingsSection>
        {isHost ? (
          <button className="button" disabled={snapshot.players.length < 2} onClick={() => send("game.start")}>
            {snapshot.players.length < 2 ? t("lobby.needPlayers") : t("lobby.start")}
          </button>
        ) : (
          <p className="lobby-waiting-host">
            <Loader2 size={15} aria-hidden="true" className="lobby-waiting-host-spin" />
            {t("lobby.waitingHost")}
          </p>
        )}
      </aside>
    </section>
  );
}

export function Board({
  snapshot,
  send,
  onLeave,
  selectedCard,
  setSelectedCard,
  rulesOpen,
  onOpenRules
}: {
  snapshot: GameSnapshot;
  send: (type: string, payload?: unknown) => void;
  onLeave: () => void;
  selectedCard: Card | null;
  setSelectedCard: (card: Card | null) => void;
  rulesOpen: boolean;
  onOpenRules: () => void;
}) {
  const t = useTranslations();
  const [batchSelecting, setBatchSelecting] = useState(false);
  const [batchShortcutCommand, setBatchShortcutCommand] = useState<BatchShortcutCommand | null>(null);
  const [utilityPanel, setUtilityPanel] = useState<"log" | "scores" | "viewers" | null>(null);
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
  const batchResolving = Boolean(snapshot.pendingBatchPlay);
  const flipResolving = Boolean(snapshot.pendingFlip);
  const pendingDraw = snapshot.pendingDraw;
  const drawResolving = Boolean(pendingDraw);
  const chaosBlocking = Boolean(snapshot.pendingChaos && !(snapshot.pendingChaos.kind === "nuke" && snapshot.pendingChaos.phase === "countdown"));
  // While you hunt for a Wild Draw Color, the controls + collection inflate the
  // hand row; flag it so the board lets the table compress instead of growing
  // the page past the viewport (a scrollbar that vanished on dismount).
  const selfColorDraw = isSelfColorHunt(snapshot);
  const actionLocked = Boolean(snapshot.oneWindow) || eventLocked || playerAway || paused || batchResolving || flipResolving || drawResolving || chaosBlocking;
  const canCallOne =
    isPlayer &&
    !finished &&
    !playerAway &&
    !eventLocked &&
    !batchSelecting &&
    !batchResolving &&
    !drawResolving &&
    snapshot.oneWindow?.playerId === snapshot.self?.id &&
    snapshot.self?.hand.length === 1 &&
    !me?.calledOne;
  const canTakeStack =
    isMyTurn &&
    !snapshot.pendingChallenge &&
    snapshot.pendingStack?.targetPlayerId === snapshot.self?.id &&
    !actionLocked &&
    !batchSelecting;
  const canDraw =
    (isMyTurn && !snapshot.pendingStack && !snapshot.self?.drawnCardId && !actionLocked && !batchSelecting) || Boolean(canTakeStack);
  const oneTarget =
    isPlayer && !finished && !playerAway && !eventLocked && !batchSelecting && !batchResolving && !drawResolving && snapshot.oneWindow && snapshot.oneWindow.playerId !== me?.id
      ? snapshot.players.find((player) => player.id === snapshot.oneWindow?.playerId && player.cardCount === 1 && !player.calledOne)
      : undefined;
  const oneWindow = snapshot.oneWindow;
  const callShortcutReady = Boolean(canCallOne) && isShortcutWindowOpen(oneWindow, now);
  const catchShortcutTarget =
    oneTarget && isShortcutWindowOpen(oneWindow, now) ? oneTarget : undefined;
  const canPass = Boolean(isMyTurn && snapshot.self?.drawnCardId && !actionLocked && !batchSelecting && !selectedCard);
  const canBatch = !selectedCard && batchCardGroups(snapshot, actionLocked).length > 0;
  const canBatchChallengeStack = Boolean(
    canBatch &&
      snapshot.pendingChallenge?.challengerId === snapshot.self?.id &&
      snapshot.pendingStack?.challengeable &&
      snapshot.pendingStack.targetPlayerId === snapshot.self?.id
  );
  const manualColorDrawReady = Boolean(
    pendingDraw?.playerId === snapshot.self?.id &&
      pendingDraw?.reason === "colorHunt" &&
      pendingDraw?.mode === "manual" &&
      !pendingDraw?.reveal &&
      !playerAway
  );
  const jumpInShortcutCard = jumpInCardInHand(snapshot);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreShortcut(event)) {
        return;
      }

      const key = shortcutKey(event);
      if (!key) {
        return;
      }

      const command = resolveGameShortcut(key, {
        enabled: snapshot.settings.keyboardShortcutsEnabled,
        canDraw: (canDraw || manualColorDrawReady) && !selectedCard && !rulesOpen,
        canPass: canPass && !rulesOpen,
        canCallOne: callShortcutReady && !selectedCard && !snapshot.pendingChallenge && !rulesOpen,
        catchTargetId: !selectedCard && !snapshot.pendingChallenge && !rulesOpen ? catchShortcutTarget?.id : undefined,
        canJumpIn: Boolean(jumpInShortcutCard) && !selectedCard && !rulesOpen && !batchSelecting && !batchResolving && !drawResolving && !chaosBlocking,
        canBatch: canBatch && !rulesOpen,
        batchSelecting,
        canOpenRules:
          isPlayer &&
          snapshot.phase === "playing" &&
          !finished &&
          !playerAway &&
          !paused &&
          !eventLocked &&
          !batchResolving &&
          !batchSelecting &&
          !selectedCard &&
          !snapshot.pendingChallenge &&
          !rulesOpen,
        colorPickerOpen: Boolean(selectedCard)
      });

      if (!command) {
        return;
      }

      event.preventDefault();
      switch (command.type) {
        case "draw":
          send(manualColorDrawReady ? "game.drawColorCard" : "game.drawCard");
          break;
        case "pass":
          send("game.playDrawn", { play: false });
          break;
        case "callOne":
          send("game.callOne");
          break;
        case "catchOne":
          send("game.catchOne", { targetId: command.targetId });
          break;
        case "jumpIn":
          if (jumpInShortcutCard) {
            send("game.playCard", { cardId: jumpInShortcutCard.id });
          }
          break;
        case "toggleBatch":
          setBatchShortcutCommand((current) => ({ id: (current?.id ?? 0) + 1, type: "toggle" }));
          break;
        case "closeBatch":
          setBatchShortcutCommand((current) => ({ id: (current?.id ?? 0) + 1, type: "close" }));
          break;
        case "closeColorPicker":
          setSelectedCard(null);
          break;
        case "openRules":
          onOpenRules();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    actionLocked,
    batchResolving,
    batchSelecting,
    callShortcutReady,
    canBatch,
    canDraw,
    canPass,
    catchShortcutTarget,
    chaosBlocking,
    eventLocked,
    finished,
    isPlayer,
    manualColorDrawReady,
    onOpenRules,
    paused,
    playerAway,
    rulesOpen,
    selectedCard,
    send,
    setSelectedCard,
    snapshot
  ]);

  useEffect(() => {
    if (!isPlayer || finished || playerAway || (selectedCard && !playableCardInHand(snapshot, selectedCard))) {
      setSelectedCard(null);
    }
  }, [finished, isPlayer, playerAway, selectedCard, setSelectedCard, snapshot]);

  function play(card: Card) {
    if (!isPlayer || finished || playerAway || eventLocked || batchSelecting || batchResolving || drawResolving || chaosBlocking) {
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
    if (eventLocked || playerAway || batchResolving || drawResolving || chaosBlocking) {
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

  function playBatch(cards: Card[], declaredColor?: Color) {
    if (!isPlayer || finished || playerAway || eventLocked || batchResolving || drawResolving || chaosBlocking) {
      return;
    }

    send("game.playBatch", {
      cardIds: cards.map((card) => card.id),
      ...(declaredColor ? { declaredColor } : {})
    });
  }

  return (
    <>
      <section className={`board${selfColorDraw ? " board--color-draw" : ""}`}>
        <div className="board-zone relative">
          <Suspense fallback={null}><RoundTable snapshot={snapshot} isMyTurn={isMyTurn} canDraw={canDraw} onDraw={() => send("game.drawCard")} /></Suspense>
          {snapshot.pendingDraw ? <DrawProgress snapshot={snapshot} /> : null}
          {snapshot.pendingChaos ? <ChaosChoicePanel snapshot={snapshot} send={send} /> : null}
          {paused ? <PauseBanner /> : null}
        </div>

        <div className="board-zone relative">
          <div className="contextual-action-rail">
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
            {isPlayer && !finished && !playerAway && !paused ? (
              <ChallengeModal
                snapshot={snapshot}
                send={send}
                actionLocked={eventLocked || batchSelecting || batchResolving || chaosBlocking || playerAway || paused || Boolean(selectedCard)}
                canBatchStack={canBatchChallengeStack}
                onBatchStack={() => setBatchShortcutCommand((current) => ({ id: (current?.id ?? 0) + 1, type: "toggle" }))}
              />
            ) : null}
          </div>
          <div
            ref={anchorRef("hand")}
            className={`hand-panel hand-reveal panel p-3 transition-shadow duration-300 ${isMyTurn ? "my-turn-glow" : ""}`}
          >
            {isPlayer && !finished ? (
              <>
                {playerAway ? <AwayHint onReturn={() => send("room.setAway", { away: false })} /> : null}
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{t("board.yourHand")}</span>
                  <span className="text-xs font-bold text-[var(--muted)]">
                {t("board.cards", { count: snapshot.self?.hand.length ?? 0 })} · {t("board.points", { score: me?.score ?? 0 })}
                  </span>
                </div>
                {pendingDraw?.playerId === snapshot.self?.id && pendingDraw?.reason === "colorHunt" ? (
                  <ColorDrawControls snapshot={snapshot} send={send} />
                ) : null}
                <Suspense fallback={null}>
                  <Hand
                    snapshot={snapshot}
                    isMyTurn={isMyTurn}
                    actionLocked={actionLocked}
                    batchShortcutCommand={batchShortcutCommand}
                    onPlay={play}
                    onPlayBatch={playBatch}
                    onBatchSelectionChange={setBatchSelecting}
                    onPassDrawn={() => send("game.playDrawn", { play: false })}
                  />
                </Suspense>
              </>
            ) : (
              <ViewerStatus snapshot={snapshot} role={finished ? "spectator" : selfRole} finishedRank={me?.finishedRank} />
            )}
          </div>
        </div>
      </section>

      <GameUtilityDock
        snapshot={snapshot}
        panel={utilityPanel}
        onSelect={(next) => setUtilityPanel((current) => current === next ? null : next)}
        onClose={() => setUtilityPanel(null)}
      />

      <Suspense fallback={null}><FlightLayer /></Suspense>
      <TurnBanner />
      <TurnAlertLayer isMyTurn={isMyTurn} isAway={playerAway} roomCode={snapshot.code} />
      <Suspense fallback={null}><GameEventOverlay /></Suspense>
      <RoundEndOverlay snapshot={snapshot} send={send} onLeave={onLeave} />
      <AnimatePresence>
        {selectedCard ? <ColorPicker disabled={eventLocked} flipSide={snapshot.flipSide} onPick={chooseColor} onCancel={() => setSelectedCard(null)} /> : null}
      </AnimatePresence>
    </>
  );
}

// Makes the auto-play behavior legible to a player who marked themselves away,
// with a one-tap path back to taking their own turns.
function AwayHint({ onReturn }: { onReturn: () => void }) {
  const t = useTranslations();

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--gold)]/45 bg-[var(--gold)]/10 px-3 py-2">
      <div className="min-w-0">
        <div className="display text-sm font-black text-[var(--gold)]">{t("board.awaySelf")}</div>
        <div className="text-xs text-[var(--muted)]">{t("board.awaySelfHint")}</div>
      </div>
      <button type="button" className="button !min-h-9 !px-3 text-sm" onClick={onReturn}>
        {t("room.return")}
      </button>
    </div>
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

function ChaosChoicePanel({ snapshot, send }: { snapshot: GameSnapshot; send: (type: string, payload?: unknown) => void }) {
  const t = useTranslations();
  const pending = snapshot.pendingChaos;
  const selfId = snapshot.self?.id;
  if (!pending || pending.chooserId !== selfId) {
    return null;
  }

  if (pending.phase === "chooseTarget") {
    const targets = snapshot.players.filter((player) => pending.eligibleTargetIds?.includes(player.id));
    return (
      <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-30 mx-auto max-w-xl rounded-2xl border border-white/15 bg-black/82 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-2 text-center text-sm font-black uppercase text-[var(--gold)]">{t("chaos.chooseTarget")}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {targets.map((player) => (
            <button
              key={player.id}
              type="button"
              className="button secondary !min-h-10 !px-3 text-sm"
              onClick={() => send("game.chooseChaosTarget", { targetId: player.id })}
            >
              {player.nickname}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (pending.phase === "chooseCard" && pending.selectableCards?.length) {
    const target = snapshot.players.find((player) => player.id === pending.targetId);
    return (
      <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-30 mx-auto max-w-3xl rounded-2xl border border-white/15 bg-black/82 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-2 text-center text-sm font-black uppercase text-[var(--gold)]">
          {t("chaos.chooseCard", { name: target?.nickname ?? "" })}
        </div>
        <div className="thin-scroll flex max-h-36 gap-2 overflow-x-auto pb-1">
          {pending.selectableCards.map((card: ChaosSelectableCard) => (
            <button
              key={card.id}
              type="button"
              className="grid shrink-0 justify-items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1.5 hover:bg-white/10"
              onClick={() => send("game.chooseChaosCard", { cardId: card.id })}
              aria-label={`${t("chaos.choose")} ${cardText(card)}`}
            >
              <CardView card={card} small />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function DrawProgress({ snapshot }: { snapshot: GameSnapshot }) {
  const t = useTranslations();
  const localNow = useNow(50);
  const clockOffset = useRoomStore((state) => state.clockOffset);
  const pending = snapshot.pendingDraw;
  if (!pending) return null;
  const recipient = snapshot.players.find((player) => player.id === pending.playerId);
  const total = pending.totalCount;
  const displayCount = pending.reveal?.index ?? pending.drawnCount;
  const progress = total
    ? t("board.drawProgressFixed", { current: displayCount, total })
    : pending.reason === "colorHunt"
      ? t("board.drawProgressColor", {
          drawn: displayCount,
          current: pending.matchesFound ?? 0,
          total: pending.requiredMatches ?? 1,
          color: pending.targetColor ? t(`colors.${pending.targetColor}`) : ""
        })
      : t("board.drawProgress", { count: pending.drawnCount });
  const revealVisible = Boolean(pending.reveal && localNow + clockOffset >= pending.reveal.revealsAt);
  const completedFaces = pending.revealedCards ?? [];
  const completedCards = Array.from({ length: pending.drawnCount }, (_, index) => completedFaces[index]);
  const visibleCardCount = completedCards.length + (pending.reveal ? 1 : 0);

  return (
    <div className="pointer-events-none absolute right-2 top-2 z-30 flex max-w-[calc(100%-16px)] justify-end">
      <div className="draw-progress-panel" role="status" aria-live="polite">
        <div className="draw-progress-header">
          <div className="display truncate text-sm font-black">{t("board.drawingFor", { name: recipient?.nickname ?? t("board.waiting") })}</div>
          <div className="text-xs font-bold text-[var(--gold)]">{progress}</div>
        </div>
        {completedCards.length > 0 || pending.reveal ? (
          <div
            className="draw-collection-row"
            style={{ "--draw-card-count": Math.max(1, visibleCardCount) } as CSSProperties}
          >
            {completedCards.map((card, index) => (
              <span key={`drawn-${index}`} className="draw-collection-card" style={{ zIndex: index + 1 }}>
                {card ? <CardView card={card} small /> : <CardView hidden small />}
              </span>
            ))}
            {pending.reveal ? (
              <span className="draw-collection-card current" style={{ zIndex: visibleCardCount + 1 }}>
                {revealVisible && pending.reveal.visibleCard ? <CardView card={pending.reveal.visibleCard} small /> : <CardView hidden small />}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ColorDrawControls({ snapshot, send }: { snapshot: GameSnapshot; send: (type: string, payload?: unknown) => void }) {
  const t = useTranslations();
  const pending = snapshot.pendingDraw;
  const now = useNow(250);
  if (!pending || pending.reason !== "colorHunt") return null;
  const seconds = pending.deadline ? Math.max(0, Math.ceil((pending.deadline - now) / 1000)) : 0;
  const busy = Boolean(pending.reveal);

  return (
    <div className="color-draw-controls" role="region" aria-label={t("board.colorDrawTitle")}>
      <div className="min-w-0">
        <div className="display text-sm font-black text-[var(--gold)]">{t("board.colorDrawTitle")}</div>
        <div className="text-xs text-[var(--muted)]">
          {t("board.colorDrawStatus", {
            found: pending.matchesFound ?? 0,
            required: pending.requiredMatches ?? 1,
            color: pending.targetColor ? t(`colors.${pending.targetColor}`) : "",
            seconds
          })}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {pending.mode === "choice" ? (
          <>
            <button type="button" className="button secondary !min-h-9 !px-3 text-sm" disabled={busy} onClick={() => send("game.chooseColorDraw", { mode: "manual" })}>
              {t("board.manualDraw")}
            </button>
            <button type="button" className="button !min-h-9 !px-3 text-sm" disabled={busy} onClick={() => send("game.chooseColorDraw", { mode: "auto" })}>
              {t("board.autoDrawColor")}
            </button>
          </>
        ) : pending.mode === "manual" ? (
          <button type="button" className="button !min-h-9 !px-3 text-sm" disabled={busy} aria-keyshortcuts="D" onClick={() => send("game.drawColorCard")}>
            {busy ? t("board.revealingCard") : t("board.drawNextCard")}
          </button>
        ) : (
          <span className="rounded-full bg-black/35 px-3 py-2 text-xs font-black text-[var(--muted)]">{t("board.autoDrawing")}</span>
        )}
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
                {player.autoPlay ? (
                  <span className="text-xs text-[var(--gold)]">
                    {t(snapshot.settings.absentPlayerAction === "autoplay" ? "board.autoPlay" : "board.autoDraw")}
                  </span>
                ) : null}
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

function GameUtilityDock({
  snapshot,
  panel,
  onSelect,
  onClose
}: {
  snapshot: GameSnapshot;
  panel: "log" | "scores" | "viewers" | null;
  onSelect: (panel: "log" | "scores" | "viewers") => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const entries = snapshot.actionLog.slice(-12).reverse();
  const sortedPlayers = [...snapshot.players].sort((a, b) => b.score - a.score || a.seat - b.seat);

  return (
    <div className="game-utility-root">
      <nav className="game-utility-nav" aria-label={t("board.tableTools")}>
        <button type="button" className={panel === "log" ? "is-active" : ""} onClick={() => onSelect("log")} title={t("board.log")}>
          <List size={18} aria-hidden="true" />
          <span>{t("board.log")}</span>
        </button>
        <button type="button" className={panel === "scores" ? "is-active" : ""} onClick={() => onSelect("scores")} title={t("board.scoreboard")}>
          <Trophy size={18} aria-hidden="true" />
          <span>{t("board.scoreboard")}</span>
        </button>
        <button type="button" className={panel === "viewers" ? "is-active" : ""} onClick={() => onSelect("viewers")} title={t("board.viewers")}>
          <Eye size={18} aria-hidden="true" />
          <span>{snapshot.viewers.length}</span>
        </button>
      </nav>
      <AnimatePresence>
        {panel ? (
          <motion.aside
            className="game-utility-panel surface premium-scroll"
            initial={{ opacity: 0, x: 14, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <header>
              <div>
                <p className="section-label">{t("common.appName")}</p>
                <h2 className="display mt-1 text-lg font-black">
                  {panel === "log" ? t("board.log") : panel === "scores" ? t("board.scoreboard") : t("board.viewers")}
                </h2>
              </div>
              <button type="button" className="icon-control" onClick={onClose} aria-label={t("common.close")}>
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            {panel === "log" ? <div className="game-utility-list">
        {entries.map((entry, index) => (
          <div
            key={entry.seq}
            className="flex items-start gap-1.5"
            style={{ opacity: 0.45 + 0.55 * ((entries.length - index) / entries.length) }}
          >
            <span aria-hidden="true">{LOG_ICON[entry.type] ?? "•"}</span>
            <span className="min-w-0 flex-1">{translateLog(entry.message, t as Translate)}</span>
          </div>
        ))}
      </div> : null}

            {panel === "scores" ? (
              <div className="game-utility-list">
                {sortedPlayers.map((player, index) => (
                  <div key={player.id} className="game-score-row">
                    <span className="game-score-rank">{index + 1}</span>
                    <Avatar avatarId={player.avatarId} size={30} />
                    <span className="min-w-0 flex-1 truncate font-black">{player.nickname}</span>
                    <strong className="tabular-nums text-[var(--gold)]">{player.score}</strong>
                  </div>
                ))}
              </div>
            ) : null}

            {panel === "viewers" ? (
              <div className="game-utility-list">
                {snapshot.viewers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--muted)]">{t("board.noViewers")}</p>
                ) : snapshot.viewers.map((viewer) => (
                  <div key={viewer.id} className="game-score-row">
                    <Avatar avatarId={viewer.avatarId} size={30} />
                    <span className="min-w-0 flex-1 truncate font-black">{viewer.nickname}</span>
                    <span className="text-xs font-bold text-[var(--muted)]">{t(`board.roles.${viewer.role}`)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
