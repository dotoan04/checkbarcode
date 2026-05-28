// Scoring engine: turns per-layer statuses into a weighted total and a verdict.

import {
  LAYER_WEIGHTS,
  STATUS_BASE_POINTS,
  VERDICT_THRESHOLDS,
} from "./config";
import type {
  BarcodeResult,
  LayerResult,
  ProviderOutput,
  Verdict,
} from "./types";
import type { GtinAnalysis } from "./gtin";

export function scoreLayer(
  layerId: string,
  layerName: string,
  output: ProviderOutput,
  elapsedMs: number
): LayerResult {
  const weight = LAYER_WEIGHTS[layerId] ?? 1.0;
  const base = STATUS_BASE_POINTS[output.status] ?? 0;
  const score = Math.round(base * weight);
  return {
    layerId,
    layerName,
    status: output.status,
    score,
    weightApplied: weight,
    evidence: output.evidence,
    note: output.note,
    elapsedMs,
  };
}

function verdictFromScore(score: number): Verdict {
  if (score <= VERDICT_THRESHOLDS.safeMax) return "SAFE";
  if (score <= VERDICT_THRESHOLDS.warningMax) return "WARNING";
  return "DANGER";
}

function buildRecommendation(verdict: Verdict, layers: LayerResult[]): string {
  if (verdict === "INVALID") {
    return "Barcode is structurally invalid. Fix the number before any further check.";
  }

  const conflicts = layers.filter((l) => l.status === "CONFLICT");
  const found = layers.filter((l) => l.status === "FOUND");
  const unknown = layers.filter(
    (l) => l.status === "UNKNOWN" || l.status === "ERROR"
  );

  if (verdict === "DANGER") {
    const where = conflicts.length
      ? conflicts.map((l) => l.layerName).join(", ")
      : found.map((l) => l.layerName).join(", ");
    return `Do NOT use. Strong prior-usage / brand conflict detected at: ${where}. This barcode was likely used by another seller or brand.`;
  }
  if (verdict === "WARNING") {
    const where = [...conflicts, ...found].map((l) => l.layerName).join(", ");
    let msg = `Use with caution. Some usage signals found at: ${where || "one or more layers"}. Manually review before listing.`;
    if (unknown.length) {
      msg += ` Note: ${unknown.length} layer(s) could not be verified (no credential / source unreachable).`;
    }
    return msg;
  }
  // SAFE
  if (unknown.length) {
    return `Likely safe, but ${unknown.length} layer(s) could not be verified. Enable their API credentials for a conclusive result.`;
  }
  return "Safe to use. No prior usage or brand conflict detected across checked layers.";
}

export function buildResult(
  input: string,
  analysis: GtinAnalysis,
  layers: LayerResult[]
): BarcodeResult {
  // Structural failure short-circuits to INVALID regardless of layer scores.
  if (!analysis.valid) {
    return {
      input,
      analysis,
      layers,
      totalScore: 0,
      verdict: "INVALID",
      recommendation: buildRecommendation("INVALID", layers),
    };
  }

  const totalScore = layers.reduce((sum, l) => sum + l.score, 0);
  const verdict = verdictFromScore(totalScore);
  return {
    input,
    analysis,
    layers,
    totalScore,
    verdict,
    recommendation: buildRecommendation(verdict, layers),
  };
}
