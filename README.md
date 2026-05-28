# Barcode Risk Checker

A web tool that assesses the **reuse / conflict risk** of GTIN/EAN/UPC barcodes
before you list products. Bought legitimate barcodes can still carry the history
of a previous owner — stale marketplace listings, cached entries, Google
Manufacturer Center brand associations — which cause conflicts when listing.
This tool checks each barcode through independent layers and returns a verdict.

## How it works

Input (typed barcodes or an imported Excel/CSV) flows through a multi-layer
pipeline. Each layer is an independent **provider** that can be enabled, disabled
or swapped for an official API. Every layer returns a status
(`CLEAR / FOUND / CONFLICT / UNKNOWN / ERROR`); a weighted scoring engine
aggregates these into a verdict.

| Layer | What it checks | Source (no credentials) | Authoritative upgrade |
|-------|----------------|-------------------------|-----------------------|
| **0 — Validation** | Check digit, format, GS1 prefix, country, restricted ranges | Local (always works) | — |
| **1 — GS1 ownership** | Who registered the GTIN | Public Verified-by-GS1 lookup (best-effort) | `GS1_API_KEY` |
| **2 — Marketplace** | Existing listings + brand | UPCitemdb `offers[]` (free) | Amazon SP-API |
| **3 — Google** | Shopping / Manufacturer Center brand association | — | Google Content API |
| **4 — Web footprint** | Any web reference to the code | DuckDuckGo HTML | — |

### Verdict

- Structural failure (`bad check digit / length`) short-circuits to **INVALID**.
- Otherwise each layer contributes `base points × layer weight`
  (`CONFLICT` > `FOUND` > `UNKNOWN` ≈ `ERROR` > `CLEAR`).
- Total score maps to **🟢 SAFE** / **🟡 WARNING** / **🔴 DANGER**.
- A `CONFLICT` means prior usage attributed to a brand that is **not yours**
  (configured in `lib/config.ts`).

Tune weights, thresholds and your own brand names in
[`lib/config.ts`](lib/config.ts).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Type barcodes (one per line, or comma/space separated) or import an Excel/CSV
(see [`sample-barcodes.csv`](sample-barcodes.csv)). Results are color-coded;
expand a row for the per-layer breakdown, and export the report to Excel.

## Enabling official APIs

Copy `.env.example` to `.env.local` and fill in the credentials you have. Layers
without credentials report `UNKNOWN` (a small uncertainty penalty) so the verdict
stays honest rather than falsely "safe". Provider implementations live in
[`lib/providers/`](lib/providers/) — each is a single file implementing the
`Provider` interface, with a `TODO` marking where the official API call goes.

## Project structure

```
app/
  page.tsx              UI (input + results)
  api/check/route.ts    POST endpoint: barcodes -> results
lib/
  gtin.ts               Layer 0: validation + prefix/country
  scoring.ts            weighted scoring + verdict + recommendation
  config.ts             weights, thresholds, own-brand identity
  types.ts              shared domain types
  excel.ts              Excel/CSV import & export
  providers/            one file per layer (gs1, upcitemdb, amazon, google, web)
components/             InputPanel, ResultsTable, ResultDetail
```
