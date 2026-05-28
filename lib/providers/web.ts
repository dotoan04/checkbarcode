// Tang 4 - General web footprint via DuckDuckGo HTML endpoint (keyless).
// The barcode number itself is a near-unique string; organic web hits for it
// strongly suggest the code has been published somewhere before.

import type { GtinAnalysis } from "../gtin";
import type { CheckContext, Provider, ProviderOutput } from "../types";
import { fetchWithTimeout, matchesOwnBrand } from "./http";

interface Hit {
  title: string;
  url: string;
  snippet: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).trim();
}

function parseDuckDuckGo(html: string): Hit[] {
  const hits: Hit[] = [];
  // Result anchors: <a ... class="result__a" href="...">Title</a>
  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html))) snippets.push(stripTags(sm[1]));

  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = linkRe.exec(html)) && hits.length < 12) {
    let href = decodeEntities(m[1]);
    // DuckDuckGo wraps links: /l/?uddg=<encoded>
    const wrapped = href.match(/[?&]uddg=([^&]+)/);
    if (wrapped) {
      try {
        href = decodeURIComponent(wrapped[1]);
      } catch {
        /* keep original */
      }
    }
    hits.push({ title: stripTags(m[2]), url: href, snippet: snippets[i] ?? "" });
    i++;
  }
  return hits;
}

export const webProvider: Provider = {
  id: "web",
  name: "Web footprint (search engine)",

  isEnabled() {
    return true;
  },

  async run(gtin: GtinAnalysis, ctx: CheckContext): Promise<ProviderOutput> {
    const q = `"${gtin.normalized}"`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;

    let html: string;
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `q=${encodeURIComponent(q)}`,
      });
      if (!res.ok) {
        return { status: "UNKNOWN", evidence: [], note: `Search HTTP ${res.status}.` };
      }
      html = await res.text();
    } catch {
      return { status: "UNKNOWN", evidence: [], note: "Search engine unreachable." };
    }

    const hits = parseDuckDuckGo(html);
    if (!hits.length) {
      return {
        status: "CLEAR",
        evidence: [],
        note: "No web pages reference this barcode.",
      };
    }

    const evidence = hits.slice(0, 6).map((h) => ({
      label: "Web result",
      detail: `${h.title}${h.snippet ? " — " + h.snippet : ""}`.slice(0, 220),
      url: h.url,
    }));

    // If any hit clearly mentions one of our brands, it's our footprint.
    const ours = hits.some(
      (h) =>
        matchesOwnBrand(h.title, ctx.ownBrandNames) ||
        matchesOwnBrand(h.snippet, ctx.ownBrandNames)
    );

    // Web footprint is noisy, so we never escalate it to CONFLICT on its own.
    return {
      status: "FOUND",
      evidence,
      note: `${hits.length} web reference(s) found for this barcode${ours ? " (some mention your brand)" : ""}.`,
    };
  },
};
