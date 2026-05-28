// Central configuration: scoring weights, verdict thresholds, and the
// company's own brand identity used to distinguish "our usage" from "a conflict".

import type { CheckContext } from "./types";

// Base risk points assigned per layer status, BEFORE multiplying by the layer weight.
// CONFLICT (found + attributed to a different brand) is the strongest signal.
export const STATUS_BASE_POINTS: Record<string, number> = {
  CLEAR: 0,
  UNKNOWN: 3, // small uncertainty penalty; we could not clear the layer
  ERROR: 3,
  FOUND: 10, // barcode shows prior usage somewhere
  CONFLICT: 20, // prior usage attributed to a brand that is not ours
};

// Per-layer weight multiplier. Higher = this layer matters more for the verdict.
export const LAYER_WEIGHTS: Record<string, number> = {
  gs1: 2.0, // registered ownership is the most authoritative signal
  upcitemdb: 1.5, // aggregated product DB incl. marketplace offers
  amazon: 1.5,
  google: 1.2,
  web: 1.0, // general web footprint is the weakest/noisiest signal
};

// Verdict thresholds on the total weighted score.
export const VERDICT_THRESHOLDS = {
  safeMax: 15, // <= safeMax  -> SAFE
  warningMax: 45, // <= warningMax -> WARNING, else DANGER
};

// Company identity. Edit these to match the brands you legitimately own so the
// engine can tell "this barcode is associated with US" from "with someone else".
export const DEFAULT_CONTEXT: CheckContext = {
  ownCompanyName: "MaxBiocare",
  ownBrandNames: ["maxbiocare", "biocare"],
};
