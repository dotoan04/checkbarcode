// Tang 1 - GS1 ownership. Authoritative answer to "who registered this GTIN".
//
// Without a "Verified by GS1" API key, we attempt the public results endpoint
// best-effort and degrade to UNKNOWN if it is unreachable or unparseable.
// When GS1_API_KEY is configured, the official API path is used instead.

import type { GtinAnalysis } from "../gtin";
import type { CheckContext, Provider, ProviderOutput } from "../types";
import { fetchWithTimeout, matchesOwnBrand } from "./http";

const GS1_API_KEY = process.env.GS1_API_KEY;

// Official Verified by GS1 API (enabled only when a key is present).
async function lookupViaOfficialApi(gtin: string): Promise<ProviderOutput | null> {
  if (!GS1_API_KEY) return null;
  try {
    const res = await fetchWithTimeout(
      `https://grp.gs1.org/grp/v3/report/${encodeURIComponent(gtin)}`,
      { headers: { APIKey: GS1_API_KEY } }
    );
    if (!res.ok) return { status: "UNKNOWN", evidence: [], note: `GS1 API HTTP ${res.status}.` };
    const data: any = await res.json();
    const company =
      data?.licenseeName || data?.companyName || data?.gs1Licence?.licenceeName;
    if (!company) {
      return { status: "UNKNOWN", evidence: [], note: "GS1 API returned no licensee." };
    }
    return {
      status: "FOUND",
      evidence: [{ label: "Registered owner (GS1)", detail: company, brand: company }],
      note: `Registered to "${company}".`,
    };
  } catch {
    return { status: "ERROR", evidence: [], note: "GS1 API request failed." };
  }
}

// Best-effort public scrape. The public results page renders the licensee
// company name; we extract it heuristically when present.
async function lookupViaPublic(gtin: string): Promise<ProviderOutput> {
  const url = `https://www.gs1.org/services/verified-by-gs1/results?gtin=${encodeURIComponent(gtin)}`;
  let html: string;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { status: "UNKNOWN", evidence: [], note: `Public GS1 lookup HTTP ${res.status}.` };
    }
    html = await res.text();
  } catch {
    return { status: "UNKNOWN", evidence: [], note: "Public GS1 lookup unreachable." };
  }

  // Try to pull a licensee/company name from common field markers.
  const patterns = [
    /"companyName"\s*:\s*"([^"]+)"/i,
    /"licenseeName"\s*:\s*"([^"]+)"/i,
    /Company name[^<]*<[^>]*>\s*([^<]+)</i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]?.trim()) {
      const company = m[1].trim();
      return {
        status: "FOUND",
        evidence: [
          {
            label: "Registered owner (GS1, public)",
            detail: company,
            brand: company,
            url,
          },
        ],
        note: `Public GS1 record lists licensee "${company}".`,
      };
    }
  }

  // No structured owner found -> inconclusive (NOT a clear).
  return {
    status: "UNKNOWN",
    evidence: [{ label: "GS1 lookup", detail: "No licensee extracted from public page.", url }],
    note: "Could not determine registered owner without a GS1 API key.",
  };
}

export const gs1Provider: Provider = {
  id: "gs1",
  name: "GS1 ownership (Verified by GS1)",

  isEnabled() {
    return true; // always runs; degrades to UNKNOWN without a key
  },

  async run(gtin: GtinAnalysis, ctx: CheckContext): Promise<ProviderOutput> {
    const code = gtin.normalized;
    const official = await lookupViaOfficialApi(code);
    const out = official ?? (await lookupViaPublic(code));

    // If we found a registered owner, classify ours vs conflict.
    if (out.status === "FOUND") {
      const owner = out.evidence.find((e) => e.brand)?.brand;
      if (owner && !matchesOwnBrand(owner, ctx.ownBrandNames)) {
        return {
          ...out,
          status: "CONFLICT",
          note: `GTIN is registered to "${owner}", which is not one of your brands.`,
        };
      }
      if (owner) {
        return {
          ...out,
          status: "CLEAR",
          note: `GTIN is registered to "${owner}", which matches your brand list.`,
        };
      }
    }
    return out;
  },
};
