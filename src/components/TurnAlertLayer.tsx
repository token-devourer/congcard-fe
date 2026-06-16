"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { playTurnAlert } from "@/lib/sound";
import { safeGet } from "@/lib/storage";

export const NOTIFY_STORAGE_KEY = "congcard:turn-notify";

const FLASH_INTERVAL_MS = 1000;
const CHIME_REPEAT_MS = 3000;
const MAX_CHIMES = 4;

// Compact attention favicon (gold-ringed dark tile + red dot), inline as a data
// URI so no extra static asset or App Router path handling is needed.
const ALERT_FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="16" fill="#0f1814" stroke="#f2c14e" stroke-width="4"/>' +
      '<circle cx="32" cy="32" r="15" fill="#e0493c" stroke="#fff" stroke-width="4"/>' +
      "</svg>"
  );

function isTabAway(): boolean {
  if (typeof document === "undefined") return false;
  return document.hidden || !document.hasFocus();
}

function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Alerts a player whose tab is hidden/unfocused that it is their turn:
 * background chime (repeating, capped), browser notification (opt-in), tab
 * title + favicon flash, and a mobile vibration. Everything stops the moment
 * the tab regains focus or the turn ends. Also owns document.title.
 */
export function TurnAlertLayer({ isMyTurn, roomCode }: { isMyTurn: boolean; roomCode: string }) {
  const t = useTranslations();
  const liveRef = useRef<HTMLDivElement | null>(null);

  const flashTimer = useRef<number | undefined>(undefined);
  const chimeTimer = useRef<number | undefined>(undefined);
  const chimeCount = useRef(0);
  const flashOn = useRef(false);
  const alerting = useRef(false);
  const baseIcon = useRef<string | null>(null);
  const evaluateRef = useRef<(() => void) | undefined>(undefined);

  // Latest values, read by the long-lived listeners without re-subscribing.
  const latest = useRef({
    isMyTurn,
    appName: t("common.appName"),
    yourTurn: t("events.yourTurn"),
    notifyTitle: t("alerts.yourTurnTitle"),
    notifyBody: t("alerts.yourTurnBody", { code: roomCode })
  });
  latest.current = {
    isMyTurn,
    appName: t("common.appName"),
    yourTurn: t("events.yourTurn"),
    notifyTitle: t("alerts.yourTurnTitle"),
    notifyBody: t("alerts.yourTurnBody", { code: roomCode })
  };

  useEffect(() => {
    const iconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    baseIcon.current = iconLink?.getAttribute("href") ?? null;

    function applyTitle() {
      const { isMyTurn: my, appName, yourTurn } = latest.current;
      if (my && isTabAway()) {
        document.title = flashOn.current ? `🔔 ${yourTurn}` : appName;
      } else if (my) {
        document.title = `${yourTurn} · ${appName}`;
      } else {
        document.title = appName;
      }
    }

    function applyFavicon(on: boolean) {
      if (!iconLink) return;
      iconLink.setAttribute("href", on ? ALERT_FAVICON : baseIcon.current ?? "");
    }

    function chime() {
      if (chimeCount.current >= MAX_CHIMES) return;
      chimeCount.current += 1;
      playTurnAlert();
      chimeTimer.current = window.setTimeout(() => {
        if (latest.current.isMyTurn && isTabAway()) {
          chime();
        }
      }, CHIME_REPEAT_MS);
    }

    function notify() {
      if (typeof Notification === "undefined") return;
      if (safeGet(NOTIFY_STORAGE_KEY) !== "1" || Notification.permission !== "granted" || !document.hidden) return;
      try {
        const note = new Notification(latest.current.notifyTitle, {
          body: latest.current.notifyBody,
          tag: "congcard-your-turn",
          icon: baseIcon.current ?? "/icon.svg"
        });
        note.onclick = () => {
          window.focus();
          note.close();
        };
      } catch {
        // Notification construction can throw on some platforms — ignore.
      }
    }

    function startAlert() {
      if (alerting.current) return;
      alerting.current = true;
      flashOn.current = true;
      applyTitle();
      applyFavicon(true);
      flashTimer.current = window.setInterval(() => {
        flashOn.current = !flashOn.current;
        applyTitle();
      }, FLASH_INTERVAL_MS);
      chimeCount.current = 0;
      chime();
      if (canVibrate()) navigator.vibrate([200, 100, 200]);
      notify();
    }

    function stopAlert() {
      if (alerting.current) {
        alerting.current = false;
        if (flashTimer.current) window.clearInterval(flashTimer.current);
        if (chimeTimer.current) window.clearTimeout(chimeTimer.current);
        flashTimer.current = undefined;
        chimeTimer.current = undefined;
        flashOn.current = false;
        chimeCount.current = 0;
        applyFavicon(false);
        if (canVibrate()) navigator.vibrate(0);
      }
      applyTitle();
    }

    function evaluate() {
      if (latest.current.isMyTurn && isTabAway()) {
        startAlert();
      } else {
        stopAlert();
      }
      if (liveRef.current) {
        liveRef.current.textContent = latest.current.isMyTurn ? latest.current.yourTurn : "";
      }
    }

    evaluateRef.current = evaluate;
    document.addEventListener("visibilitychange", evaluate);
    window.addEventListener("focus", evaluate);
    window.addEventListener("blur", evaluate);
    evaluate();

    return () => {
      document.removeEventListener("visibilitychange", evaluate);
      window.removeEventListener("focus", evaluate);
      window.removeEventListener("blur", evaluate);
      if (flashTimer.current) window.clearInterval(flashTimer.current);
      if (chimeTimer.current) window.clearTimeout(chimeTimer.current);
      alerting.current = false;
      if (iconLink) iconLink.setAttribute("href", baseIcon.current ?? "");
      document.title = latest.current.appName;
    };
    // Mount once: listeners read fresh state via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run the alert decision whenever the turn flips.
  useEffect(() => {
    evaluateRef.current?.();
  }, [isMyTurn]);

  return <div ref={liveRef} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />;
}
