// Tang 3 - Google Shopping / Manufacturer Center.
// The authoritative check is the Content API for Shopping (products.list /
// productstatuses) which reveals whether the GTIN is already claimed/associated
// with another Merchant Center account or brand. That needs OAuth + a merchant id.
//
// Until configured this reports UNKNOWN. A keyless fallback web check for the
// barcode on google.com is intentionally avoided (heavy bot protection / captcha);
// the Web footprint layer covers generic search presence instead.

import type { GtinAnalysis } from "../gtin";
import type { CheckContext, Provider, ProviderOutput } from "../types";

const GOOGLE_MERCHANT_ID = process.env.GOOGLE_MERCHANT_ID;
const GOOGLE_OAUTH_TOKEN = process.env.GOOGLE_OAUTH_TOKEN;

function hasCredentials(): boolean {
  return Boolean(GOOGLE_MERCHANT_ID && GOOGLE_OAUTH_TOKEN);
}

export const googleProvider: Provider = {
  id: "google",
  name: "Google Shopping / Manufacturer Center",

  isEnabled() {
    return true;
  },

  async run(_gtin: GtinAnalysis, _ctx: CheckContext): Promise<ProviderOutput> {
    if (!hasCredentials()) {
      return {
        status: "UNKNOWN",
        evidence: [],
        note:
          "Google Content API credentials not configured. Set GOOGLE_MERCHANT_ID " +
          "and GOOGLE_OAUTH_TOKEN to detect brand associations in Merchant Center.",
      };
    }
    // TODO: implement Content API for Shopping lookup once credentials exist.
    // GET content/v2.1/{merchantId}/products?... filter by offerId/gtin, or use
    // productstatuses to detect data-quality conflicts on the GTIN.
    return {
      status: "UNKNOWN",
      evidence: [],
      note: "Google Content API integration is provisioned but not yet implemented.",
    };
  },
};
