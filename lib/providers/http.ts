// Small HTTP helper with timeout and a browser-like User-Agent.
// Public endpoints often reject requests without a UA.

const DEFAULT_TIMEOUT_MS = 12000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/html;q=0.9, */*;q=0.8",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// True if any of `candidates` contains one of our own brand tokens (case-insensitive).
export function matchesOwnBrand(
  candidate: string | undefined,
  ownBrandNames: string[]
): boolean {
  if (!candidate) return false;
  const c = candidate.toLowerCase();
  return ownBrandNames.some((b) => b && c.includes(b.toLowerCase()));
}
