// Shared domain types for the barcode risk-assessment pipeline.

import type { GtinAnalysis } from "./gtin";

// Outcome of a single check layer for one barcode.
export type LayerStatus =
  | "CLEAR" // checked, no prior usage / conflict found
  | "FOUND" // existing usage / association detected (a risk signal)
  | "CONFLICT" // found AND attributed to a brand different from ours (strong signal)
  | "UNKNOWN" // could not determine (no credential / source unreachable / rate limited)
  | "ERROR"; // provider failed unexpectedly

export type Verdict = "SAFE" | "WARNING" | "DANGER" | "INVALID";

// One piece of evidence a provider returns (a hit on a marketplace, a registry record...).
export interface Evidence {
  label: string; // e.g. "Amazon listing", "Registered owner"
  detail: string; // human-readable detail
  url?: string; // source link if available
  brand?: string; // brand/company attributed to the barcode, if known
}

export interface LayerResult {
  layerId: string; // stable id, e.g. "gs1"
  layerName: string; // display name, e.g. "GS1 ownership"
  status: LayerStatus;
  score: number; // risk points contributed by this layer (>= 0)
  weightApplied: number; // configured weight used
  evidence: Evidence[];
  note?: string; // short explanation of the status
  elapsedMs: number;
}

export interface BarcodeResult {
  input: string;
  analysis: GtinAnalysis; // Tang 0 output
  layers: LayerResult[];
  totalScore: number;
  verdict: Verdict;
  recommendation: string;
}

// Context passed to every provider so it can compare against our own identity.
export interface CheckContext {
  ownBrandNames: string[]; // brands the company legitimately owns (lowercased compare)
  ownCompanyName?: string;
}

export interface Provider {
  id: string;
  name: string;
  // True when the provider has what it needs to actually run (e.g. credentials).
  isEnabled(): boolean;
  run(gtin: GtinAnalysis, ctx: CheckContext): Promise<ProviderOutput>;
}

// Raw provider output before scoring weights are applied.
export interface ProviderOutput {
  status: LayerStatus;
  evidence: Evidence[];
  note?: string;
}
