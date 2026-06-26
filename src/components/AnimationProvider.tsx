"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type GraphicsTier, PRESETS, detectGraphicsTier, type AnimationPreset } from "@/lib/animationPresets";
import { safeGet, safeSet } from "@/lib/storage";

interface GraphicsContextValue {
  tier: GraphicsTier;
  preset: AnimationPreset;
  setTier: (tier: GraphicsTier) => void;
  autoDetected: boolean;
}

const GraphicsContext = createContext<GraphicsContextValue>({
  tier: "high",
  preset: PRESETS.high,
  setTier: () => {},
  autoDetected: false,
});

export function useGraphicsPreset(): GraphicsContextValue {
  return useContext(GraphicsContext);
}

export function AnimationProvider({ children }: { children: ReactNode }) {
  const [tier, setTierState] = useState<GraphicsTier>("high");
  const [autoDetected, setAutoDetected] = useState(false);

  const setTier = useCallback((newTier: GraphicsTier) => {
    setTierState(newTier);
    if (typeof window !== "undefined") {
      safeSet("congcard:graphics-tier", newTier);
      document.documentElement.classList.toggle("low-graphics", newTier === "low");
    }
  }, []);

  useEffect(() => {
    const saved = safeGet("congcard:graphics-tier") as GraphicsTier | null;
    if (saved && (saved === "high" || saved === "low")) {
      setTier(saved);
    } else {
      const detected = detectGraphicsTier();
      setTier(detected);
      setAutoDetected(true);
    }
  }, [setTier]);

  useEffect(() => {
    document.documentElement.classList.toggle("low-graphics", tier === "low");
  }, [tier]);

  const value: GraphicsContextValue = {
    tier,
    preset: PRESETS[tier],
    setTier,
    autoDetected,
  };

  return (
    <GraphicsContext.Provider value={value}>
      {children}
    </GraphicsContext.Provider>
  );
}
