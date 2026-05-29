// Provider registry and the per-barcode pipeline runner.

import { analyzeGtin } from "../gtin";
import { buildResult, scoreLayer } from "../scoring";
import type { BarcodeResult, CheckContext, LayerResult, Provider } from "../types";
import { gs1Provider } from "./gs1";
import { upcitemdbProvider } from "./upcitemdb";
import { amazonProvider } from "./amazon";
import { googleProvider } from "./google";
import { webProvider } from "./web";

// Order here defines display order in the result.
export const PROVIDERS: Provider[] = [
  gs1Provider,
  upcitemdbProvider,
  amazonProvider,
  googleProvider,
  webProvider,
];

// Run every enabled layer for one barcode. Layers are independent -> run in parallel.
export async function checkOne(
  input: string,
  ctx: CheckContext
): Promise<BarcodeResult> {
  const analysis = analyzeGtin(input);

  // Structural failure short-circuits: no point hitting the network.
  if (!analysis.valid) {
    return buildResult(input, analysis, []);
  }

  const layers: LayerResult[] = await Promise.all(
    PROVIDERS.filter((p) => p.isEnabled()).map(async (p) => {
      const start = Date.now();
      try {
        const output = await p.run(analysis, ctx);
        return scoreLayer(p.id, p.name, output, Date.now() - start);
      } catch (err) {
        console.error(`[provider:${p.id}] Uncaught error:`, err);
        return scoreLayer(
          p.id,
          p.name,
          {
            status: "ERROR",
            evidence: [],
            note: err instanceof Error ? err.message : "Unknown error.",
          },
          Date.now() - start
        );
      }
    })
  );

  return buildResult(input, analysis, layers);
}

// Run a batch with a small concurrency cap so we do not hammer public endpoints.
export async function checkBatch(
  inputs: string[],
  ctx: CheckContext,
  concurrency = 3
): Promise<BarcodeResult[]> {
  const results: BarcodeResult[] = new Array(inputs.length);
  let cursor = 0;

  async function worker() {
    while (cursor < inputs.length) {
      const index = cursor++;
      results[index] = await checkOne(inputs[index], ctx);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, worker);
  await Promise.all(workers);
  return results;
}
