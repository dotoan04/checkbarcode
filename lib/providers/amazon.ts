// Tang 2 - Amazon catalog via SP-API Catalog Items 2022-04-01.
//
// Flow (no AWS SigV4 signing required since Oct 2023):
//   1. Exchange the LWA refresh token for a short-lived access token.
//   2. GET /catalog/2022-04-01/items?identifiers=<gtin>&identifiersType=EAN|UPC
//      &marketplaceIds=<id>&includedData=summaries  with header x-amz-access-token.
//   3. Map returned summaries -> evidence; CONFLICT if a brand differs from ours.
//
// Credentials are read from the environment at runtime; this module never logs them.

import type { GtinAnalysis } from "../gtin";
import type { CheckContext, Evidence, Provider, ProviderOutput } from "../types";
import { fetchWithTimeout, matchesOwnBrand } from "./http";

const CLIENT_ID = process.env.AMAZON_SP_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_SP_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AMAZON_SP_REFRESH_TOKEN;
const MARKETPLACE_ID = process.env.AMAZON_SP_MARKETPLACE_ID || "ATVPDKIKX0DER"; // US default
const ENDPOINT =
  process.env.AMAZON_SP_ENDPOINT || "https://sellingpartnerapi-na.amazon.com";
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

function hasCredentials(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

// Storefront domain per marketplace, for building human-clickable listing links.
const MARKETPLACE_DOMAIN: Record<string, string> = {
  ATVPDKIKX0DER: "amazon.com",
  A2EUQ1WTGCTBG2: "amazon.ca",
  A1AM78C64UM0Y8: "amazon.com.mx",
  A1F83G8C2ARO7P: "amazon.co.uk",
  A1PA6795UKMFR9: "amazon.de",
  A13V1IB3VIYZZH: "amazon.fr",
  APJ6JRA9NG5V4: "amazon.it",
  A1RKKUPIHCS9HS: "amazon.es",
  A1VC38T7YXB528: "amazon.co.jp",
  A39IBJ37TRP1C6: "amazon.com.au",
};

// ---- Access-token cache (module-level, shared across requests) ----
interface TokenCache {
  token: string;
  expiresAt: number; // epoch ms
}
let tokenCache: TokenCache | null = null;
let inflight: Promise<string> | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token; // still valid with a 60s safety margin
  }
  if (inflight) return inflight; // coalesce concurrent refreshes

  inflight = (async () => {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN as string,
      client_id: CLIENT_ID as string,
      client_secret: CLIENT_SECRET as string,
    });
    console.log("[amazon] LWA token exchange: POST", LWA_TOKEN_URL);
    const res = await fetchWithTimeout(LWA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "<unreadable body>");
      console.error(
        `[amazon] LWA token exchange failed: HTTP ${res.status} ${res.statusText}`,
        "body:",
        errBody.slice(0, 1000)
      );
      throw new Error(`LWA token exchange failed (HTTP ${res.status}): ${errBody.slice(0, 300)}`);
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      console.error("[amazon] LWA response missing access_token. Keys:", Object.keys(data));
      throw new Error("LWA response missing access_token.");
    }
    console.log(
      `[amazon] LWA token OK (expires_in=${data.expires_in ?? "?"}s)`
    );
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return tokenCache.token;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

// Pick the identifier type SP-API expects for this GTIN length.
function identifierType(gtin: GtinAnalysis): "EAN" | "UPC" | "GTIN" {
  if (gtin.format === "GTIN-12") return "UPC";
  if (gtin.format === "GTIN-13") return "EAN";
  return "GTIN";
}

interface CatalogSummary {
  marketplaceId?: string;
  brand?: string;
  brandName?: string;
  itemName?: string;
}
interface CatalogItem {
  asin?: string;
  summaries?: CatalogSummary[];
}
interface CatalogResponse {
  numberOfResults?: number;
  items?: CatalogItem[];
}

export const amazonProvider: Provider = {
  id: "amazon",
  name: "Amazon catalog (SP-API)",

  isEnabled() {
    return true; // always listed; explains itself via UNKNOWN when unconfigured
  },

  async run(gtin: GtinAnalysis, ctx: CheckContext): Promise<ProviderOutput> {
    if (!hasCredentials()) {
      return {
        status: "UNKNOWN",
        evidence: [],
        note:
          "Amazon SP-API not fully configured. Required: AMAZON_SP_CLIENT_ID, " +
          "AMAZON_SP_CLIENT_SECRET, AMAZON_SP_REFRESH_TOKEN (and optionally " +
          "AMAZON_SP_MARKETPLACE_ID). See Amazon offers under the UPCitemdb layer meanwhile.",
      };
    }

    let token: string;
    try {
      token = await getAccessToken();
    } catch (err) {
      console.error("[amazon] getAccessToken failed:", err);
      return {
        status: "UNKNOWN",
        evidence: [],
        note: err instanceof Error ? err.message : "LWA token error.",
      };
    }

    const params = new URLSearchParams({
      identifiers: gtin.normalized,
      identifiersType: identifierType(gtin),
      marketplaceIds: MARKETPLACE_ID,
      includedData: "summaries",
      pageSize: "10",
    });
    const url = `${ENDPOINT}/catalog/2022-04-01/items?${params.toString()}`;
    console.log(
      `[amazon] Catalog request: GET ${url} (gtin=${gtin.normalized}, type=${identifierType(gtin)}, marketplace=${MARKETPLACE_ID})`
    );

    let res: Response;
    try {
      res = await fetchWithTimeout(url, { headers: { "x-amz-access-token": token } });
    } catch (err) {
      console.error("[amazon] Catalog fetch error:", err);
      return {
        status: "ERROR",
        evidence: [],
        note: `Catalog request failed or timed out: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    console.log(
      `[amazon] Catalog response: HTTP ${res.status} ${res.statusText} (x-amzn-RequestId=${res.headers.get("x-amzn-requestid") ?? "-"})`
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "<unreadable body>");
      console.error(
        `[amazon] Catalog error body (HTTP ${res.status}):`,
        errBody.slice(0, 2000)
      );

      if (res.status === 429) {
        return {
          status: "UNKNOWN",
          evidence: [],
          note: `Amazon rate limit reached; retry later. ${errBody.slice(0, 200)}`,
        };
      }
      if (res.status === 403) {
        return {
          status: "UNKNOWN",
          evidence: [],
          note: `Amazon returned 403. Check the app role has the Catalog Items (Product Listing) scope. Detail: ${errBody.slice(0, 300)}`,
        };
      }
      return {
        status: "UNKNOWN",
        evidence: [],
        note: `Amazon catalog HTTP ${res.status}: ${errBody.slice(0, 300)}`,
      };
    }

    let data: CatalogResponse;
    try {
      data = (await res.json()) as CatalogResponse;
    } catch (err) {
      console.error("[amazon] Unparseable Amazon response:", err);
      return { status: "UNKNOWN", evidence: [], note: "Unparseable Amazon response." };
    }
    console.log(
      `[amazon] Catalog parsed: numberOfResults=${data.numberOfResults ?? "?"} items=${data.items?.length ?? 0}`
    );

    const items = data.items ?? [];
    if (!items.length) {
      return { status: "CLEAR", evidence: [], note: "No Amazon catalog listing for this barcode." };
    }

    const domain = MARKETPLACE_DOMAIN[MARKETPLACE_ID] || "amazon.com";
    const evidence: Evidence[] = [];
    const brands = new Set<string>();

    for (const item of items.slice(0, 8)) {
      const summary = item.summaries?.find((s) => s.marketplaceId === MARKETPLACE_ID)
        ?? item.summaries?.[0];
      const brand = (summary?.brand || summary?.brandName)?.trim();
      if (brand) brands.add(brand);
      evidence.push({
        label: `Amazon listing${item.asin ? ` (ASIN ${item.asin})` : ""}`,
        detail: [summary?.itemName, brand ? `brand: ${brand}` : null].filter(Boolean).join(" — "),
        url: item.asin ? `https://www.${domain}/dp/${item.asin}` : undefined,
        brand,
      });
    }

    const brandList = Array.from(brands);
    const foreignBrand = brandList.find((b) => !matchesOwnBrand(b, ctx.ownBrandNames));

    if (foreignBrand) {
      return {
        status: "CONFLICT",
        evidence,
        note: `Active Amazon listing(s) under another brand: "${foreignBrand}".`,
      };
    }
    if (brandList.length) {
      return {
        status: "FOUND",
        evidence,
        note: `Amazon listing(s) found under your brand (${brandList.join(", ")}). Verify intentional.`,
      };
    }
    return {
      status: "FOUND",
      evidence,
      note: `${items.length} Amazon listing(s) reference this barcode.`,
    };
  },
};
