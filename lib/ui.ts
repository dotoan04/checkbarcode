// Presentation tokens shared across UI components.

import type { LayerStatus, Verdict } from "./types";

export interface VerdictStyle {
  label: string;
  color: string; // hex for dots / meters
  badge: string; // tailwind classes for the stamp-style badge
  ring: string; // border accent
  glyph: string; // small mark shown in the verdict stamp
}

export const VERDICT_STYLE: Record<Verdict, VerdictStyle> = {
  SAFE: {
    label: "Safe",
    color: "#2f7d4f",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-600/40",
    ring: "border-emerald-600/40",
    glyph: "✓",
  },
  WARNING: {
    label: "Caution",
    color: "#b07313",
    badge: "bg-amber-50 text-amber-800 border-amber-600/40",
    ring: "border-amber-600/40",
    glyph: "!",
  },
  DANGER: {
    label: "Do not use",
    color: "#b3261e",
    badge: "bg-red-50 text-red-800 border-red-600/40",
    ring: "border-red-600/40",
    glyph: "✕",
  },
  INVALID: {
    label: "Invalid",
    color: "#6b6457",
    badge: "bg-stone-100 text-stone-700 border-stone-500/40",
    ring: "border-stone-500/40",
    glyph: "—",
  },
};

export interface StatusStyle {
  label: string;
  badge: string;
  color: string;
}

export const STATUS_STYLE: Record<LayerStatus, StatusStyle> = {
  CLEAR: {
    label: "Clear",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-600/30",
    color: "#2f7d4f",
  },
  FOUND: {
    label: "Found",
    badge: "bg-amber-50 text-amber-700 border-amber-600/30",
    color: "#b07313",
  },
  CONFLICT: {
    label: "Conflict",
    badge: "bg-red-50 text-red-700 border-red-600/30",
    color: "#b3261e",
  },
  UNKNOWN: {
    label: "Unverified",
    badge: "bg-stone-100 text-stone-500 border-stone-400/30",
    color: "#8a8378",
  },
  ERROR: {
    label: "Error",
    badge: "bg-stone-100 text-stone-500 border-stone-400/30",
    color: "#8a8378",
  },
};

// Map a layer id to its stage number (Tang 0 = validation, handled separately).
export const LAYER_STAGE: Record<string, number> = {
  gs1: 1,
  upcitemdb: 2,
  amazon: 2,
  google: 3,
  web: 4,
};
