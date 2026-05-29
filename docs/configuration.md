# Configuration / Cấu hình

## Environment variables / Biến môi trường

**EN —** All API credentials live in `.env` (production) or `.env.local` (dev). Both files are git-ignored. Only `.env.example` is committed as a template. Edit the values in place — never commit secrets.

**VN —** Tất cả credentials API nằm trong `.env` (production) hoặc `.env.local` (dev). Cả hai file đều bị git ignore. Chỉ `.env.example` được commit làm template. Sửa giá trị tại chỗ — không commit secret.

### Full key reference / Danh sách đầy đủ

| Key | Required | Used by | Description EN | Mô tả VN |
|---|:-:|---|---|---|
| `GS1_API_KEY` | no | Layer 1 (gs1) | Verified-by-GS1 official API key. Without it the layer falls back to public scrape. | API key Verified-by-GS1 chính thức. Không có → fallback scrape công khai. |
| `AMAZON_SP_CLIENT_ID` | for AMZ | Layer 2b (amazon) | LWA app client ID from Amazon Developer Console. | LWA client ID lấy từ Amazon Developer Console. |
| `AMAZON_SP_CLIENT_SECRET` | for AMZ | Layer 2b | LWA app secret. Treat as sensitive. | LWA secret. Coi như nhạy cảm. |
| `AMAZON_SP_REFRESH_TOKEN` | for AMZ | Layer 2b | LWA refresh token issued when a seller authorizes the app. Region-locked. | LWA refresh token, được cấp khi seller authorize app. Khoá theo region. |
| `AMAZON_SP_MARKETPLACE_ID` | for AMZ | Layer 2b | One Amazon marketplace ID (e.g. `A39IBJ37TRP1C6` = AU, `ATVPDKIKX0DER` = US). | Một marketplace ID Amazon (vd `A39IBJ37TRP1C6` = AU). |
| `AMAZON_SP_ENDPOINT` | for AMZ | Layer 2b | SP-API regional endpoint; must match the region of `MARKETPLACE_ID`. See table below. | Endpoint SP-API theo region; phải khớp region của `MARKETPLACE_ID`. Xem bảng dưới. |
| `GOOGLE_MERCHANT_ID` | no | Layer 3 (google) | Merchant Center account ID. Used when layer 3 is implemented. | Merchant Center account ID. Dùng khi layer 3 được implement. |
| `GOOGLE_OAUTH_TOKEN` | no | Layer 3 | OAuth access token for Content API. Note: production should use a service account, not a static token. | OAuth access token cho Content API. Production nên dùng service account, không phải token tĩnh. |

### Amazon region table / Bảng region Amazon

| Endpoint | Region | Marketplaces |
|---|---|---|
| `https://sellingpartnerapi-na.amazon.com` | North America | US (`ATVPDKIKX0DER`), CA (`A2EUQ1WTGCTBG2`), MX (`A1AM78C64UM0Y8`), BR (`A2Q3Y263D00KWC`) |
| `https://sellingpartnerapi-eu.amazon.com` | Europe | UK (`A1F83G8C2ARO7P`), DE (`A1PA6795UKMFR9`), FR (`A13V1IB3VIYZZH`), IT (`APJ6JRA9NG5V4`), ES (`A1RKKUPIHCS9HS`), NL, IN, AE, SA, TR, ZA, SE, PL, BE, IE, EG |
| `https://sellingpartnerapi-fe.amazon.com` | Far East | AU (`A39IBJ37TRP1C6`), JP (`A1VC38T7YXB528`), SG |

**Critical / Quan trọng:** **EN —** A refresh token issued from an AU seller account only works against the FE endpoint. Using the wrong endpoint returns HTTP 403 *"Access to requested resource is denied"* — see [troubleshooting.md](troubleshooting.md). — **VN —** Refresh token cấp từ tài khoản AU chỉ chạy được trên endpoint FE. Sai endpoint trả HTTP 403 *"Access to requested resource is denied"* — xem [troubleshooting.md](troubleshooting.md).

## In-code config / Cấu hình trong code

File: [`lib/config.ts`](../lib/config.ts)

### Brand identity / Định danh brand

```ts
export const DEFAULT_CONTEXT: CheckContext = {
  ownCompanyName: "MaxBiocare",
  ownBrandNames: ["maxbiocare", "biocare"],
};
```

**EN —** Set these to match the company that owns this deployment. They drive the CLEAR-vs-CONFLICT decision: when a layer returns an owner / brand, the engine checks whether the returned string `includes()` any of `ownBrandNames` (case-insensitive). If yes → it's ours → CLEAR. If no → CONFLICT.

Pick brand tokens that uniquely identify your company. Avoid generic terms ("health", "labs") that might appear in unrelated listings and produce false `CLEAR`.

**VN —** Set giá trị khớp công ty deploy. Đây là yếu tố quyết định CLEAR vs CONFLICT: khi một layer trả về owner / brand, engine check chuỗi đó có `includes()` bất kỳ phần tử nào trong `ownBrandNames` không (case-insensitive). Có → của ta → CLEAR. Không → CONFLICT.

Chọn token brand đủ độc nhất. Tránh từ chung chung ("health", "labs") có thể xuất hiện trong listing không liên quan → false `CLEAR`.

### Scoring / Chấm điểm

```ts
export const STATUS_BASE_POINTS: Record<string, number> = {
  CLEAR: 0,
  UNKNOWN: 3,
  ERROR: 3,
  FOUND: 10,
  CONFLICT: 20,
};

export const LAYER_WEIGHTS: Record<string, number> = {
  gs1: 2.0,
  upcitemdb: 1.5,
  amazon: 1.5,
  google: 1.2,
  web: 1.0,
};

export const VERDICT_THRESHOLDS = {
  safeMax: 15,
  warningMax: 45,
};
```

**EN —** Tune these to your risk tolerance.

- **More conservative** (more barcodes flagged as risky): lower `safeMax` (e.g. 8) and `warningMax` (e.g. 30); raise `UNKNOWN`/`ERROR` to 5.
- **More permissive** (fewer false alarms, more manual review): raise `safeMax` to 25 and `warningMax` to 60; lower `UNKNOWN` to 1.

After editing, restart the app (`docker compose up -d --build` or `npm run dev`). Constants are read at module load.

**VN —** Chỉnh theo mức độ chấp nhận rủi ro.

- **Bảo thủ hơn** (flag nhiều barcode hơn): hạ `safeMax` (vd 8) và `warningMax` (vd 30); nâng `UNKNOWN`/`ERROR` lên 5.
- **Dễ dãi hơn** (ít false alarm, review thủ công nhiều hơn): nâng `safeMax` lên 25 và `warningMax` lên 60; hạ `UNKNOWN` xuống 1.

Sau khi sửa, restart app (`docker compose up -d --build` hoặc `npm run dev`). Constants được đọc lúc module load.

## Adding / removing layers / Thêm bớt layer

File: [`lib/providers/index.ts`](../lib/providers/index.ts)

```ts
export const PROVIDERS: Provider[] = [
  gs1Provider,
  upcitemdbProvider,
  amazonProvider,
  googleProvider,
  webProvider,
];
```

**EN —** Comment out a provider to disable its layer entirely (the layer just won't appear in results). To temporarily disable based on env var, edit the provider's `isEnabled()`:

```ts
isEnabled() {
  return process.env.AMAZON_DISABLED !== "true";
}
```

**VN —** Comment một provider để vô hiệu lớp đó hoàn toàn (lớp đó sẽ không xuất hiện trong kết quả). Để tắt tạm dựa trên env var, sửa `isEnabled()` của provider:

```ts
isEnabled() {
  return process.env.AMAZON_DISABLED !== "true";
}
```

## Server-side limits / Giới hạn server

File: [`app/api/check/route.ts`](../app/api/check/route.ts)

- `MAX_BARCODES = 200` — per-request cap. Raise carefully — each barcode triggers ~5 outbound HTTP calls.
- `maxDuration = 60` — Next.js route timeout in seconds. Vercel Hobby caps at 10s; self-hosted has no upper bound. For batches near 200 increase to 120-180s.
- HTTP timeout per outbound call: `12000ms` in [`lib/providers/http.ts`](../lib/providers/http.ts).
- Batch concurrency: `3` in [`lib/providers/index.ts`](../lib/providers/index.ts) — `checkBatch()` runs at most 3 barcodes concurrently to stay under public-endpoint rate limits.
