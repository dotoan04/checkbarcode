# Architecture / Kiến trúc

## High-level pipeline / Pipeline tổng quát

```
                       INPUT (paste / upload Excel/CSV)
                                    │
                                    ▼
                       app/api/check/route.ts (POST /api/check)
                                    │
                                    ▼
                       lib/providers/index.ts → checkBatch()
                                    │
                ┌───────────────────┴───────────────────┐
                │      one BarcodeResult per input      │
                ▼                                       ▼
        Layer 0: analyzeGtin() ──── short-circuit ──► INVALID
        (offline, deterministic)
                │ valid
                ▼
        Run layers 1–4 in PARALLEL (Promise.all)
        ┌────────┬────────┬─────────┬────────┬────────┐
        ▼        ▼        ▼         ▼        ▼        ▼
       gs1   upcitemdb  amazon   google    web      (each returns LayerStatus)
        │        │        │        │        │
        └────────┴────────┴────────┴────────┘
                            │
                            ▼
                   scoreLayer() per layer
                   (status base × layer weight)
                            │
                            ▼
                   buildResult() → total score → verdict
                   SAFE / WARNING / DANGER
```

**EN —** Each layer is an independent **provider** implementing the same `Provider` interface ([`lib/types.ts`](../lib/types.ts)). They are listed in [`lib/providers/index.ts`](../lib/providers/index.ts) and dispatched in parallel — the runtime of `checkOne()` is the runtime of the slowest provider, not the sum.

**VN —** Mỗi lớp là một **provider** độc lập implement cùng interface `Provider` ([`lib/types.ts`](../lib/types.ts)). Danh sách trong [`lib/providers/index.ts`](../lib/providers/index.ts), được chạy song song — thời gian xử lý của `checkOne()` bằng thời gian của provider chậm nhất, không phải tổng.

## Layer 0 — Local validation / Validate cục bộ

File: [`lib/gtin.ts`](../lib/gtin.ts)

**EN —** Pure, offline, deterministic. Performs:

1. **Length detection** — `8 / 12 / 13 / 14` → `GTIN-8 / UPC-A / EAN-13 / GTIN-14`. Any other length is invalid.
2. **Check-digit verification** — mod-10 with alternating weights `3,1,3,1...` from the right. The implementation in `computeCheckDigit()` works for all GTIN lengths.
3. **GS1 prefix lookup** — first three digits map to an issuing organization (country MO) via the table at [`lib/gtin.ts:28-159`](../lib/gtin.ts#L28-L159). Examples: `893` → Vietnam, `930-939` → Australia, `00-19` → US/Canada (UPC).
4. **Restricted-range flag** — prefixes `20-29, 40-49, 200-299` (in-store), `50-59, 981-984, 990-999` (coupons), `977` (ISSN), `978-979` (ISBN) are **not** real retail GTINs and are flagged as restricted.

If the check digit fails or the length is invalid → the result is `INVALID` and **no network layer is called**.

**VN —** Thuần túy, offline, deterministic. Thực hiện:

1. **Phát hiện độ dài** — `8 / 12 / 13 / 14` → `GTIN-8 / UPC-A / EAN-13 / GTIN-14`. Độ dài khác là invalid.
2. **Kiểm tra check digit** — mod-10 với trọng số xen kẽ `3,1,3,1...` từ phải. Hàm `computeCheckDigit()` chạy cho mọi độ dài GTIN.
3. **Tra prefix GS1** — 3 chữ số đầu map sang tổ chức cấp phát (MO của quốc gia) qua bảng tại [`lib/gtin.ts:28-159`](../lib/gtin.ts#L28-L159). Ví dụ: `893` → Việt Nam, `930-939` → Úc, `00-19` → US/Canada (UPC).
4. **Flag dải hạn chế** — prefix `20-29, 40-49, 200-299` (in-store), `50-59, 981-984, 990-999` (coupon), `977` (ISSN), `978-979` (ISBN) **không phải** retail GTIN thật.

Nếu check digit sai hoặc độ dài invalid → kết quả là `INVALID` và **không gọi layer mạng nào**.

## Layer 1 — GS1 ownership / Quyền sở hữu GS1

File: [`lib/providers/gs1.ts`](../lib/providers/gs1.ts)

**EN —** The authoritative answer to "who registered this GTIN". Two paths:

- **Official API** (`grp.gs1.org/grp/v3/report/<gtin>` with header `APIKey: <GS1_API_KEY>`) — used when `GS1_API_KEY` is set. Returns the licensee name. Only available to GS1 Members or approved Solution Providers.
- **Public scrape fallback** (`gs1.org/services/verified-by-gs1/results?gtin=...`) — used when no key. Extracts the licensee name from the rendered HTML using a small set of regex patterns.

If the discovered owner matches one of `ctx.ownBrandNames` (case-insensitive contains) → `CLEAR`. If a different owner is named → `CONFLICT`. If no owner can be extracted → `UNKNOWN`.

**VN —** Câu trả lời chính thức cho "ai đăng ký GTIN này". Hai đường:

- **Official API** — dùng khi có `GS1_API_KEY`. Trả về tên licensee. Chỉ cấp cho GS1 Member hoặc Solution Provider được duyệt.
- **Public scrape fallback** — dùng khi không có key. Extract tên licensee từ HTML rendered qua một bộ regex.

Nếu owner tìm được khớp một trong `ctx.ownBrandNames` (case-insensitive contains) → `CLEAR`. Nếu owner là tên khác → `CONFLICT`. Nếu không extract được → `UNKNOWN`.

**Important / Lưu ý:** **EN —** Even with a GS1 API key, if your barcodes were bought from a reseller (not licensed directly to your company), the GS1 Registry will show the **original prefix owner**, not you. This layer is therefore the canonical detector of "bought-back" barcode risk. — **VN —** Kể cả có GS1 API key, nếu barcode mua từ reseller (không licensed trực tiếp cho công ty), GS1 Registry vẫn hiện **chủ prefix gốc**, không phải bạn. Layer này vì vậy chính là detector chính xác nhất cho rủi ro "barcode mua lại".

## Layer 2 — UPCitemdb / Cơ sở dữ liệu sản phẩm

File: [`lib/providers/upcitemdb.ts`](../lib/providers/upcitemdb.ts)

**EN —** Aggregator that combines product data and marketplace offers (Amazon, eBay, Walmart, Google Shopping…). Uses the free trial endpoint `api.upcitemdb.com/prod/trial/lookup?upc=<gtin>` — no key required, ~100 req/day rate limit.

Returns:
- `CLEAR` if HTTP 404 or `items` is empty.
- `CONFLICT` if there is an item with a `brand` that does **not** match `ownBrandNames`.
- `FOUND` if there is an item but no brand, or the brand matches our own brand (verify intentional).
- `UNKNOWN` on HTTP 429 (rate limit) — does not falsely "clear" the layer.

The `offers[]` list (≤8) is surfaced as evidence with merchant + listing URL — useful for follow-up manual review.

**VN —** Aggregator gom dữ liệu sản phẩm và offer marketplace (Amazon, eBay, Walmart, Google Shopping…). Dùng trial endpoint free, không cần key, giới hạn ~100 req/ngày.

Trả về:
- `CLEAR` khi HTTP 404 hoặc `items` rỗng.
- `CONFLICT` khi có item với `brand` **không** khớp `ownBrandNames`.
- `FOUND` khi có item mà không có brand, hoặc brand khớp brand của ta (verify ý đồ).
- `UNKNOWN` khi HTTP 429 (rate limit) — không "clear" sai layer.

Danh sách `offers[]` (≤8) được show làm evidence kèm merchant + URL — hữu ích cho review thủ công sau đó.

## Layer 2b — Amazon SP-API / Catalog Items / Catalog Items

File: [`lib/providers/amazon.ts`](../lib/providers/amazon.ts)

**EN —** Direct check against Amazon's Catalog Items API (2022-04-01). Required env vars:

```
AMAZON_SP_CLIENT_ID
AMAZON_SP_CLIENT_SECRET
AMAZON_SP_REFRESH_TOKEN
AMAZON_SP_MARKETPLACE_ID   # e.g. A39IBJ37TRP1C6 for AU
AMAZON_SP_ENDPOINT         # must match the region of the marketplace
```

Flow:
1. **LWA token exchange** — `POST https://api.amazon.com/auth/o2/token` with `refresh_token` grant. Access token is cached at module level with a 60-second safety margin (TTL ~1 hour).
2. **Catalog lookup** — `GET <endpoint>/catalog/2022-04-01/items?identifiers=<gtin>&identifiersType=<EAN|UPC|GTIN>&marketplaceIds=<id>&includedData=summaries&pageSize=10` with header `x-amz-access-token: <token>`. The identifier type is auto-derived from GTIN length.
3. **Map response** — each item's `summaries[].brand|brandName` and `itemName` become evidence; ASIN is hyperlinked to the regional storefront (e.g. `amazon.com.au/dp/<ASIN>`).

Verdicts: `CONFLICT` if any listing carries a foreign brand; `FOUND` if listings exist under your own brand; `CLEAR` if zero results.

403 from Amazon almost always means a region/auth issue — see [troubleshooting.md](troubleshooting.md).

**VN —** Check trực tiếp với Catalog Items API (2022-04-01) của Amazon. Biến môi trường bắt buộc:

```
AMAZON_SP_CLIENT_ID
AMAZON_SP_CLIENT_SECRET
AMAZON_SP_REFRESH_TOKEN
AMAZON_SP_MARKETPLACE_ID   # vd A39IBJ37TRP1C6 cho AU
AMAZON_SP_ENDPOINT         # phải khớp region của marketplace
```

Quy trình:
1. **Đổi LWA token** — `POST https://api.amazon.com/auth/o2/token` với grant `refresh_token`. Access token được cache ở module với khoảng an toàn 60 giây (TTL ~1 tiếng).
2. **Lookup catalog** — `GET <endpoint>/catalog/2022-04-01/items?...&identifiersType=<EAN|UPC|GTIN>&...` với header `x-amz-access-token`. Identifier type tự suy từ độ dài GTIN.
3. **Map response** — mỗi item lấy `summaries[].brand|brandName` và `itemName` thành evidence; ASIN gắn link đến storefront vùng (vd `amazon.com.au/dp/<ASIN>`).

Verdict: `CONFLICT` khi listing có brand khác; `FOUND` khi có listing dưới brand mình; `CLEAR` khi không có kết quả.

403 từ Amazon hầu như luôn là vấn đề region/auth — xem [troubleshooting.md](troubleshooting.md).

### Region ↔ endpoint mapping

| Region | Endpoint | Sample marketplace |
|---|---|---|
| North America | `https://sellingpartnerapi-na.amazon.com` | US (`ATVPDKIKX0DER`), CA, MX, BR |
| Europe | `https://sellingpartnerapi-eu.amazon.com` | UK, DE, FR, IT, ES, NL, IN, AE, SA, TR, ZA |
| Far East | `https://sellingpartnerapi-fe.amazon.com` | AU (`A39IBJ37TRP1C6`), JP, SG |

## Layer 3 — Google Content API / Content API

File: [`lib/providers/google.ts`](../lib/providers/google.ts)

**EN —** Stub. Provisioned but not yet implemented. When credentials are set (`GOOGLE_MERCHANT_ID` + `GOOGLE_OAUTH_TOKEN`) and the implementation lands, it will call the Content API for Shopping to check whether the GTIN is already claimed by another Merchant Center account or flagged for brand mismatch.

**VN —** Stub. Đã chừa chỗ nhưng chưa implement. Khi có credentials và code được hoàn thiện, layer sẽ gọi Content API for Shopping để kiểm tra GTIN đã bị claim bởi Merchant Center khác hoặc bị flag brand mismatch chưa.

## Layer 4 — Web footprint / Dấu vết trên web

File: [`lib/providers/web.ts`](../lib/providers/web.ts)

**EN —** Search the **literal barcode string in quotes** on DuckDuckGo HTML endpoint (`html.duckduckgo.com/html/`). Parses up to 12 result anchors. Even one organic hit suggests the code is already public somewhere.

The layer **never escalates to `CONFLICT` on its own** — search snippets are noisy and false positives are common. It reports `FOUND` (with up to 6 hits as evidence) or `CLEAR` (no hits). If a hit's title/snippet mentions one of our brands, the note marks it explicitly.

Layer weight is the lowest (1.0) so a single hit alone cannot push a barcode into `DANGER`.

**VN —** Search **chính chuỗi barcode trong dấu nháy** trên endpoint HTML của DuckDuckGo. Parse tối đa 12 link kết quả. Chỉ cần một hit organic cũng cho thấy code đã được public đâu đó.

Layer này **không bao giờ tự nâng lên `CONFLICT`** — snippet search nhiễu, false positive nhiều. Chỉ trả `FOUND` (kèm tối đa 6 hit) hoặc `CLEAR`. Nếu title/snippet có nhắc brand của ta, note ghi rõ.

Trọng số layer thấp nhất (1.0) nên một hit đơn lẻ không thể đẩy barcode lên `DANGER`.

## Scoring engine / Bộ chấm điểm

File: [`lib/scoring.ts`](../lib/scoring.ts), config: [`lib/config.ts`](../lib/config.ts)

### Base points per status / Điểm gốc theo trạng thái

| Status | Base | Meaning EN | Ý nghĩa VN |
|---|---:|---|---|
| `CLEAR` | 0 | Layer ran and found nothing | Layer chạy, không thấy gì |
| `UNKNOWN` | 3 | Could not verify | Không xác minh được |
| `ERROR` | 3 | Provider failed | Provider lỗi |
| `FOUND` | 10 | Prior usage found | Có dấu hiệu đã dùng |
| `CONFLICT` | 20 | Found AND attributed to another brand | Đã dùng VÀ thuộc về brand khác |

### Layer weights / Trọng số lớp

| Layer | Weight | Why EN | Lý do VN |
|---|---:|---|---|
| `gs1` | 2.0 | Most authoritative (registry of record) | Có thẩm quyền nhất (registry chính thức) |
| `upcitemdb` | 1.5 | Aggregated marketplace data | Dữ liệu marketplace tổng hợp |
| `amazon` | 1.5 | Marketplace-of-record | Marketplace gốc |
| `google` | 1.2 | Specific data quality signal | Tín hiệu data quality cụ thể |
| `web` | 1.0 | Noisy, weakest signal | Nhiễu, tín hiệu yếu nhất |

### Verdict thresholds / Ngưỡng verdict

`totalScore = Σ (statusBasePoints × layerWeight)` for all enabled layers.

| Total | Verdict |
|---:|---|
| ≤ 15 | **🟢 SAFE** |
| 16 – 45 | **🟡 WARNING** |
| > 45 | **🔴 DANGER** |
| (any) when GTIN invalid | **⚫ INVALID** |

### Worked example / Ví dụ

A barcode that comes back as: `gs1=CONFLICT`, `upcitemdb=CONFLICT`, `amazon=FOUND`, `google=UNKNOWN`, `web=FOUND`.

```
gs1:        20 × 2.0 = 40
upcitemdb:  20 × 1.5 = 30
amazon:     10 × 1.5 = 15
google:      3 × 1.2 =  4
web:        10 × 1.0 = 10
                       ───
                       99 → DANGER
```

Tune weights and thresholds in [`lib/config.ts`](../lib/config.ts).

Chỉnh trọng số và ngưỡng trong [`lib/config.ts`](../lib/config.ts).

## How to add a new layer / Cách thêm layer mới

1. **EN —** Create `lib/providers/<id>.ts` exporting a `Provider` (id, name, `isEnabled()`, `run()`). — **VN —** Tạo `lib/providers/<id>.ts` export một `Provider` (id, name, `isEnabled()`, `run()`).
2. **EN —** Append it to the `PROVIDERS` array in [`lib/providers/index.ts`](../lib/providers/index.ts) — display order follows the array. — **VN —** Append vào mảng `PROVIDERS` trong [`lib/providers/index.ts`](../lib/providers/index.ts) — thứ tự hiển thị theo mảng.
3. **EN —** Add the layer's weight to `LAYER_WEIGHTS` in [`lib/config.ts`](../lib/config.ts) — without it the layer still scores at default weight 1.0. — **VN —** Thêm weight vào `LAYER_WEIGHTS` trong [`lib/config.ts`](../lib/config.ts) — không có vẫn chạy với weight default 1.0.
4. **EN —** Use [`fetchWithTimeout`](../lib/providers/http.ts) for HTTP calls (timeout + browser UA) and [`matchesOwnBrand`](../lib/providers/http.ts) for brand comparison. — **VN —** Dùng [`fetchWithTimeout`](../lib/providers/http.ts) cho HTTP (timeout + UA browser) và [`matchesOwnBrand`](../lib/providers/http.ts) để so brand.
5. **EN —** Return `UNKNOWN` on rate-limit / missing credentials — do NOT return `CLEAR`. The scoring engine penalizes UNKNOWN slightly, which is the honest answer. — **VN —** Khi rate-limit / thiếu credentials → trả `UNKNOWN`, KHÔNG trả `CLEAR`. Bộ chấm điểm phạt UNKNOWN nhẹ — đó là câu trả lời trung thực.
