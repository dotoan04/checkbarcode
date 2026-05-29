# Usage guide / Hướng dẫn sử dụng

## Web UI / Giao diện web

### Input / Nhập liệu

**EN —** Two ways to feed barcodes:

1. **Paste / type** — one barcode per line, or separated by comma / space / tab. Whitespace and duplicates are auto-cleaned.
2. **Upload** — Excel (`.xlsx`, `.xls`) or CSV. The first column is treated as the barcode column by default; the importer ignores headers automatically. See [`sample-barcodes.csv`](../sample-barcodes.csv).

A single request accepts **max 200 barcodes** (server-side guard in [`app/api/check/route.ts`](../app/api/check/route.ts)). For larger batches, split the upload.

**VN —** Hai cách nhập:

1. **Paste / gõ tay** — mỗi barcode một dòng, hoặc cách nhau bởi dấu phẩy / khoảng trắng / tab. Khoảng trắng và trùng lặp tự được lọc.
2. **Upload** — Excel (`.xlsx`, `.xls`) hoặc CSV. Cột đầu tiên mặc định được coi là cột barcode; header tự được bỏ qua. Xem [`sample-barcodes.csv`](../sample-barcodes.csv).

Một request tối đa **200 barcode** (chặn server-side trong [`app/api/check/route.ts`](../app/api/check/route.ts)). Batch lớn hơn cần chia nhỏ.

### Results table / Bảng kết quả

**EN —** Each row shows: barcode, GTIN format (GTIN-8/12/13/14), issuing country/organization, verdict badge (🟢/🟡/🔴/⚫), total score, and a one-line recommendation. Click a row to expand the per-layer breakdown:

- Status badge per layer (CLEAR / FOUND / CONFLICT / UNKNOWN / ERROR)
- Score contribution (`base × weight`)
- Evidence: links to marketplace listings, GS1 records, web hits — each clickable
- Provider note (e.g. *"Active Amazon listing(s) under another brand: 'Acme Co'."*)
- Elapsed milliseconds per layer (useful for debugging slow providers)

**VN —** Mỗi dòng hiển thị: barcode, format GTIN (GTIN-8/12/13/14), tổ chức/quốc gia cấp, badge verdict (🟢/🟡/🔴/⚫), tổng điểm, và một dòng khuyến nghị. Click vào dòng để xem chi tiết từng lớp:

- Badge trạng thái mỗi lớp
- Điểm đóng góp (`base × weight`)
- Evidence: link tới listing marketplace, record GS1, web hit — click được
- Note của provider (vd *"Active Amazon listing(s) under another brand: 'Acme Co'."*)
- Thời gian (ms) mỗi lớp — hữu ích khi debug provider chậm

### Export / Xuất kết quả

**EN —** Click **Export to Excel** to download the full result set including per-layer scores, notes, and evidence URLs. The exporter is implemented in [`lib/excel.ts`](../lib/excel.ts) using the `xlsx` package.

**VN —** Click **Export to Excel** để tải bộ kết quả đầy đủ kèm điểm từng lớp, note, URL evidence. Export viết trong [`lib/excel.ts`](../lib/excel.ts) dùng package `xlsx`.

## REST API / API REST

### Endpoint

```
POST /api/check
Content-Type: application/json
```

### Request body / Body request

```json
{
  "barcodes": ["6972854379066", "0123456789012"],
  "ownCompanyName": "MaxBiocare",
  "ownBrandNames": ["maxbiocare", "biocare"]
}
```

| Field | Type | Required | Default |
|---|---|---|---|
| `barcodes` | `string[]` | yes | — |
| `ownCompanyName` | `string` | no | `DEFAULT_CONTEXT.ownCompanyName` from [`lib/config.ts`](../lib/config.ts) |
| `ownBrandNames` | `string[]` | no | `DEFAULT_CONTEXT.ownBrandNames` |

**EN —** The `ownBrandNames` are lowercased and compared with `String.includes()` — partial matches count. Example: brand names `["biocare"]` will match `"MaxBiocare Pty Ltd"` correctly.

**VN —** `ownBrandNames` được lowercase và so bằng `String.includes()` — match một phần là OK. Ví dụ brand `["biocare"]` sẽ match `"MaxBiocare Pty Ltd"`.

### Response / Phản hồi

```json
{
  "checkedAt": "2026-05-29T08:23:11.034Z",
  "results": [
    {
      "input": "6972854379066",
      "analysis": {
        "raw": "6972854379066",
        "normalized": "6972854379066",
        "valid": true,
        "format": "GTIN-13",
        "checkDigitOk": true,
        "expectedCheckDigit": 6,
        "gs1Prefix": "697",
        "prefixOrganization": "China",
        "isRestrictedCirculation": false,
        "errors": []
      },
      "layers": [
        {
          "layerId": "gs1",
          "layerName": "GS1 ownership (Verified by GS1)",
          "status": "CONFLICT",
          "score": 40,
          "weightApplied": 2.0,
          "evidence": [
            {
              "label": "Registered owner (GS1, public)",
              "detail": "Shenzhen Example Co., Ltd",
              "brand": "Shenzhen Example Co., Ltd",
              "url": "https://www.gs1.org/services/verified-by-gs1/results?gtin=6972854379066"
            }
          ],
          "note": "GTIN is registered to \"Shenzhen Example Co., Ltd\", which is not one of your brands.",
          "elapsedMs": 1842
        }
      ],
      "totalScore": 99,
      "verdict": "DANGER",
      "recommendation": "Do NOT use. Strong prior-usage / brand conflict detected at: GS1 ownership, UPCitemdb, Amazon catalog. This barcode was likely used by another seller or brand."
    }
  ]
}
```

### Error responses / Phản hồi lỗi

| HTTP | Body | Reason |
|---|---|---|
| 400 | `{ "error": "Invalid JSON body." }` | Body không phải JSON hợp lệ |
| 400 | `{ "error": "No barcodes provided." }` | Mảng `barcodes` rỗng |
| 400 | `{ "error": "Too many barcodes (N). Max 200 per request." }` | Vượt quá 200 |

### cURL example / Ví dụ cURL

```bash
curl -X POST https://barcode.mbcstaging.com/api/check \
  -H "Content-Type: application/json" \
  -d '{
    "barcodes": ["6972854379066", "0123456789012", "9300617430044"],
    "ownBrandNames": ["maxbiocare", "biocare"]
  }' | jq '.results[] | {input, verdict, totalScore}'
```

## Interpreting results / Đọc kết quả

### Verdict matrix / Bảng verdict

| Verdict | Score | Recommended action EN | Hành động đề xuất VN |
|---|---|---|---|
| **🟢 SAFE** | ≤ 15 | Use the barcode. Optional: confirm with one manual marketplace search. | Dùng được. Tùy chọn: tra thủ công thêm 1 marketplace cho chắc. |
| **🟡 WARNING** | 16 – 45 | Manual review required. Open the row, inspect each `FOUND`/`CONFLICT` layer's evidence; decide based on whether the prior usage is still active. | Cần review thủ công. Mở dòng, xem evidence từng lớp `FOUND`/`CONFLICT`; quyết định dựa trên dấu vết cũ đó còn sống không. |
| **🔴 DANGER** | > 45 | Do **not** use. Replace this barcode with a different one before listing. | **Không** dùng. Đổi barcode khác trước khi list. |
| **⚫ INVALID** | n/a | Wrong number — fix the digits, then re-check. Common cause: check-digit typo. | Sai số — sửa lại rồi check lại. Hay gặp: gõ sai check digit. |

### Common patterns / Pattern hay gặp

**EN —**

- **GS1 = CONFLICT + UPCitemdb = CONFLICT** → Classic "bought-back barcode" from a reseller. The original prefix owner still owns the code in the registry, and an existing product uses the code in marketplaces.
- **GS1 = UNKNOWN + UPCitemdb = CLEAR + Web = CLEAR** → Probably a fresh, unused code. SAFE in practice, but UNKNOWN penalty keeps verdict honest. Enable a GS1 API key for full confidence.
- **GS1 = CLEAR + Amazon = CONFLICT** → Code is registered to your company **but** somebody is already selling under your barcode on Amazon — usually a hijacker or a stale own listing. Investigate via the linked ASIN.
- **Everything = UNKNOWN** → Network is failing, or all providers are rate-limited. Retry; check server logs.

**VN —**

- **GS1 = CONFLICT + UPCitemdb = CONFLICT** → Kinh điển "barcode mua từ reseller". Chủ prefix gốc vẫn sở hữu code trong registry, và đã có sản phẩm dùng code này trên marketplace.
- **GS1 = UNKNOWN + UPCitemdb = CLEAR + Web = CLEAR** → Có vẻ là code chưa ai dùng. Thực tế SAFE, nhưng penalty UNKNOWN giữ verdict trung thực. Bật GS1 API key để chắc chắn.
- **GS1 = CLEAR + Amazon = CONFLICT** → Code đăng ký cho công ty **nhưng** có người đang bán dưới barcode của bạn trên Amazon — thường là hijacker hoặc listing cũ của chính bạn. Điều tra qua ASIN trong link.
- **Tất cả = UNKNOWN** → Mạng có vấn đề, hoặc mọi provider đang bị rate-limit. Thử lại; check log server.
