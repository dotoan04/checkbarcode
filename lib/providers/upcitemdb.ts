// Tang 2/4 - UPCitemdb (free trial endpoint, no API key).
// Aggregates product data and marketplace "offers" (Amazon, eBay, Walmart, Google...).
// A hit means the barcode already identifies a real product in circulation.
// Rate limit on the trial tier is low (~100/day); treat 429 as UNKNOWN, not a failure.

import type { GtinAnalysis } from "../gtin";
import type { CheckContext, Provider, ProviderOutput } from "../types";
import { fetchWithTimeout, matchesOwnBrand } from "./http";

interface UpcItem {
  title?: string;
  brand?: string;
  description?: string;
  offers?: { merchant?: string; domain?: string; title?: string; link?: string }[];
}

interface UpcResponse {
  code?: string;
  total?: number;
  items?: UpcItem[];
}

export const upcitemdbProvider: Provider = {
  id: "upcitemdb",
  name: "UPCitemdb (product DB & marketplace offers)",

  isEnabled() {
    return true; // keyless trial endpoint
  },

  async run(gtin: GtinAnalysis, ctx: CheckContext): Promise<ProviderOutput> {
    const code = gtin.normalized;
    const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`;

    let res: Response;
    try {
      res = await fetchWithTimeout(url);
    } catch {
      return { status: "ERROR", evidence: [], note: "Request failed or timed out." };
    }

    if (res.status === 429) {
      return {
        status: "UNKNOWN",
        evidence: [],
        note: "Rate limited by UPCitemdb trial tier. Retry later or add an API key.",
      };
    }
    if (res.status === 404) {
      return { status: "CLEAR", evidence: [], note: "No product record found." };
    }
    if (!res.ok) {
      return { status: "UNKNOWN", evidence: [], note: `HTTP ${res.status}.` };
    }

    let data: UpcResponse;
    try {
      data = (await res.json()) as UpcResponse;
    } catch {
      return { status: "UNKNOWN", evidence: [], note: "Unparseable response." };
    }

    const items = data.items ?? [];
    if (!items.length) {
      return { status: "CLEAR", evidence: [], note: "No product record found." };
    }

    const item = items[0];
    const evidence = [];
    const brand = item.brand?.trim();

    evidence.push({
      label: "Existing product record",
      detail: [item.title, brand ? `brand: ${brand}` : null]
        .filter(Boolean)
        .join(" — "),
      brand,
    });

    // Marketplace offers reveal WHERE the barcode is already listed.
    for (const offer of (item.offers ?? []).slice(0, 8)) {
      evidence.push({
        label: `Listed on ${offer.merchant || offer.domain || "marketplace"}`,
        detail: offer.title || "",
        url: offer.link,
      });
    }

    const ours = matchesOwnBrand(brand, ctx.ownBrandNames);
    if (ours) {
      return {
        status: "FOUND",
        evidence,
        note: `Product exists and brand "${brand}" appears to be ours. Verify it is intentional.`,
      };
    }

    return {
      status: brand ? "CONFLICT" : "FOUND",
      evidence,
      note: brand
        ? `Barcode already identifies product of another brand: "${brand}".`
        : "Barcode already identifies an existing product.",
    };
  },
};
