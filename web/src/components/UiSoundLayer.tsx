"use client";

import { useEffect } from "react";
import { isSoundMuted, playSound, unlockSound } from "@/lib/sound";

const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [data-sfx], input[type="button"], input[type="submit"], summary, label[for]';

function isInteractive(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  if (target.closest('[data-sfx="off"]')) return null;
  const element = target.closest(INTERACTIVE_SELECTOR);
  if (!element || !(element instanceof HTMLElement)) return null;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return null;
  return element;
}

export function UiSoundLayer() {
  useEffect(() => {
    let lastHover: HTMLElement | null = null;
    let lastHoverAt = 0;
    let lastClickAt = 0;

    function onPointerOver(event: PointerEvent) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (isSoundMuted()) return;
      const element = isInteractive(event.target);
      if (!element || element === lastHover) return;
      const now = performance.now();
      if (now - lastHoverAt < 60) return;
      lastHover = element;
      lastHoverAt = now;
      playSound("uiHover");
    }

    function onPointerOut(event: PointerEvent) {
      if (!(event.target instanceof Element)) return;
      if (lastHover && !lastHover.contains(event.relatedTarget as Node | null)) {
        lastHover = null;
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== undefined && event.button !== 0) return;
      unlockSound();
      if (isSoundMuted()) return;
      const element = isInteractive(event.target);
      if (!element) return;
      const now = performance.now();
      if (now - lastClickAt < 80) return;
      lastClickAt = now;
      playSound("uiClick");
    }

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  return null;
}
