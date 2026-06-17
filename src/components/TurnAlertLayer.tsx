"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { playTurnAlert } from "@/lib/sound";
import { safeGet } from "@/lib/storage";

export const NOTIFY_STORAGE_KEY = "congcard:turn-notify";
export const TURN_ALERT_DELAY_MS = 5000;

const FLASH_INTERVAL_MS = 1000;
const CHIME_REPEAT_MS = 3000;
const MAX_CHIMES = 4;

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

export function TurnAlertLayer({ isMyTurn, isAway, roomCode }: { isMyTurn: boolean; isAway: boolean; roomCode: string }) {
  const t = useTranslations();
  const liveRef = useRef<HTMLDivElement | null>(null);

  const delayTimer = useRef<number | undefined>(undefined);
  const flashTimer = useRef<number | undefined>(undefined);
  const chimeTimer = useRef<number | undefined>(undefined);
  const chimeCount = useRef(0);
  const flashOn = useRef(false);
  const alerting = useRef(false);
  const baseIcon = useRef<string | null>(null);
  const evaluateRef = useRef<(() => void) | undefined>(undefined);

  const latest = useRef({
    isMyTurn,
    isAway,
    appName: t("common.appName"),
    yourTurn: t("events.yourTurn"),
    notifyTitle: t("alerts.yourTurnTitle"),
    notifyBody: t("alerts.yourTurnBody", { code: roomCode })
  });
  latest.current = {
    isMyTurn,
    isAway,
    appName: t("common.appName"),
    yourTurn: t("events.yourTurn"),
    notifyTitle: t("alerts.yourTurnTitle"),
    notifyBody: t("alerts.yourTurnBody", { code: roomCode })
  };

  useEffect(() => {
    const iconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    baseIcon.current = iconLink?.getAttribute("href") ?? null;

    function shouldAlert() {
      return latest.current.isMyTurn && !latest.current.isAway;
    }

    function applyTitle() {
      const { isMyTurn: my, isAway: away, appName, yourTurn } = latest.current;
      if (my && !away && alerting.current && isTabAway()) {
        document.title = flashOn.current ? `! ${yourTurn}` : appName;
      } else if (my && !away) {
        document.title = `${yourTurn} | ${appName}`;
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
        if (shouldAlert()) {
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
        // Ignore unsupported notification surfaces.
      }
    }

    function startAlert() {
      if (alerting.current || !shouldAlert()) return;
      alerting.current = true;
      flashOn.current = true;
      applyTitle();
      applyFavicon(isTabAway());
      flashTimer.current = window.setInterval(() => {
        flashOn.current = !flashOn.current;
        applyTitle();
        applyFavicon(isTabAway());
      }, FLASH_INTERVAL_MS);
      chimeCount.current = 0;
      chime();
      if (canVibrate() && isTabAway()) navigator.vibrate([200, 100, 200]);
      notify();
    }

    function stopAlert() {
      if (delayTimer.current) window.clearTimeout(delayTimer.current);
      delayTimer.current = undefined;
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

    function scheduleAlert() {
      if (alerting.current || delayTimer.current) return;
      delayTimer.current = window.setTimeout(() => {
        delayTimer.current = undefined;
        if (shouldAlert()) {
          startAlert();
        }
      }, TURN_ALERT_DELAY_MS);
    }

    function evaluate() {
      if (shouldAlert()) {
        scheduleAlert();
        if (alerting.current) {
          applyTitle();
          applyFavicon(isTabAway());
        }
      } else {
        stopAlert();
      }
      if (liveRef.current) {
        liveRef.current.textContent = shouldAlert() ? latest.current.yourTurn : "";
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
      if (delayTimer.current) window.clearTimeout(delayTimer.current);
      if (flashTimer.current) window.clearInterval(flashTimer.current);
      if (chimeTimer.current) window.clearTimeout(chimeTimer.current);
      alerting.current = false;
      if (iconLink) iconLink.setAttribute("href", baseIcon.current ?? "");
      document.title = latest.current.appName;
    };
  }, []);

  useEffect(() => {
    evaluateRef.current?.();
  }, [isAway, isMyTurn]);

  return <div ref={liveRef} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />;
}
