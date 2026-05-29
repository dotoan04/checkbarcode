# Troubleshooting / Khắc phục sự cố

**EN —** This page covers the issues we have actually hit while building and deploying this tool. Each entry has: symptom → root cause → fix → why it happens.

**VN —** Trang này tổng hợp các vấn đề thực tế đã gặp khi build và deploy tool. Mỗi mục gồm: triệu chứng → nguyên nhân gốc → cách fix → giải thích lý do.

---

## Amazon SP-API

### 403 — Access to requested resource is denied

**Symptom / Triệu chứng**

```
[amazon] LWA token OK (expires_in=3600s)
[amazon] Catalog response: HTTP 403 (x-amzn-RequestId=...)
[amazon] Catalog error body (HTTP 403): {
  "errors":[{"code":"Unauthorized","message":"Access to requested resource is denied.","details":""}]
}
```

**EN —** LWA token exchange succeeds but the Catalog request is denied. The token is valid; the problem is downstream.

**VN —** Đổi LWA token thành công nhưng request Catalog bị từ chối. Token hợp lệ; vấn đề nằm ở phía sau.

**Root causes (in order of frequency) / Nguyên nhân (theo tần suất)**

1. **Region mismatch** — refresh token issued from a seller account in one region (e.g. AU, region FE), but `AMAZON_SP_ENDPOINT` points at a different region (e.g. `sellingpartnerapi-na.amazon.com`). The endpoint matters.
2. **Refresh token issued before role was added** — you added "Product Listing" role in Developer Console *after* the seller authorized the app. The existing token does not carry the new scope. LWA still issues an access token (it only validates client credentials), but SP-API checks scope and denies.
3. **Marketplace not registered to the seller** — the seller account has Australia activated but you are querying US (`ATVPDKIKX0DER`).
4. **App in Draft + wrong authorization path** — non-public apps must use Self-Authorization from the same Amazon account that owns the app.
5. **Vendor account instead of Seller** — Catalog Items via SP-API requires a Seller account; Vendor Central uses a different API.

**Fix / Cách fix**

1. **Match endpoint to marketplace region** — see [configuration.md](configuration.md). For AU (`A39IBJ37TRP1C6`) → `AMAZON_SP_ENDPOINT=https://sellingpartnerapi-fe.amazon.com`.
2. **Re-authorize the app** — Developer Console → app → Authorize (Self-authorization) → bấm Authorize again → copy the new refresh token → paste into `.env` → `docker compose up -d --build`.
3. **Confirm the role is enabled** — Developer Console → Edit App → Roles → tick "Product Listing" → Save.
4. **Verify marketplace** — log into Seller Central, confirm you can switch to the marketplace you're querying.

After fixing, restart the container so the cached LWA token is dropped:

```bash
docker compose restart checkbarcode
```

### 429 — TooManyRequests

**EN —** Amazon SP-API rate limit for `searchCatalogItems` is 2 req/sec, burst 2. Hitting this with concurrent batch checks is easy.

**VN —** Rate limit của Amazon SP-API cho `searchCatalogItems` là 2 req/giây, burst 2. Dễ chạm khi check batch song song.

**Fix —** Lower `concurrency` in [`lib/providers/index.ts`](../lib/providers/index.ts) (default 3 → 1 for Amazon-heavy workloads), or add a token-bucket guard inside `amazonProvider.run()`.

### LWA token exchange failed (HTTP 400)

**EN —** Most often: refresh token revoked, or `CLIENT_ID`/`CLIENT_SECRET` typo. Look at the error body in the log — Amazon returns `{ "error": "invalid_grant" }` or `{ "error": "invalid_client" }` with details.

**VN —** Thường là: refresh token bị revoke, hoặc gõ sai `CLIENT_ID`/`CLIENT_SECRET`. Xem error body trong log — Amazon trả `{ "error": "invalid_grant" }` hoặc `{ "error": "invalid_client" }` kèm chi tiết.

**Fix —** Re-authorize the app to get a fresh refresh token. Double-check no trailing whitespace in `.env`.

---

## GS1

### Public scrape returns no owner

**EN —** The Verified-by-GS1 public page may render an empty result page when:
- The GTIN was issued by a country MO that does not publish to the global registry.
- The licensee has opted out of public disclosure.
- The page renderer changed; the regex patterns in `lookupViaPublic()` no longer match.

**VN —** Trang Verified-by-GS1 public có thể trả kết quả rỗng khi:
- GTIN do MO quốc gia không publish lên registry toàn cầu.
- Licensee chọn ẩn thông tin public.
- Trang đổi cách render; regex trong `lookupViaPublic()` không match nữa.

**Fix —** Result is `UNKNOWN` — honest. For conclusive answers either obtain a `GS1_API_KEY` or accept the uncertainty.

### Can my company get a GS1 API key?

**EN —** Only if the company is a **paying GS1 Member** (has bought a Company Prefix directly from GS1, not from a reseller). Reseller-bought barcodes do **not** confer membership and do not grant API access. See [overview.md](overview.md) for why this matters.

**VN —** Chỉ khi công ty là **GS1 Member trả phí** (mua Company Prefix trực tiếp từ GS1, không phải qua reseller). Barcode mua từ reseller **không** kèm membership và không có quyền dùng API. Xem [overview.md](overview.md) để biết tại sao điều này quan trọng.

---

## Docker

### `Permission denied while trying to connect to the docker API`

```
unable to get image 'checkbarcode:latest': permission denied while trying to connect to the Docker API
```

**Fix —** Either prefix with `sudo`, or add the user to the `docker` group permanently:

```bash
sudo usermod -aG docker $USER
newgrp docker                  # apply in current shell
docker ps                       # now works without sudo
```

### Build fails: `COPY /app/public not found`

**EN —** The Next.js standalone build does not include a `/public` folder if the project never created one. Old Dockerfile templates `COPY --from=builder /app/public ./public` and fail.

**VN —** Standalone build của Next không có `/public` nếu project chưa từng tạo folder đó. Template Dockerfile cũ `COPY --from=builder /app/public ./public` sẽ fail.

**Fix —** Already applied in this repo — line removed in [`Dockerfile`](../Dockerfile). If the issue resurfaces, ensure the line is gone, then `docker compose build --no-cache`.

### Stale image after `git pull`

**EN —** Docker reuses cached layers aggressively. If you pulled code but the runtime behavior is unchanged, the build cache may be stale.

**VN —** Docker cache layer tích cực. Pull code rồi mà runtime không đổi → có thể đang dùng cache cũ.

**Fix —**

```bash
docker compose build --no-cache
docker compose up -d
```

---

## Nginx

### `nginx: configuration test failed` after adding the vhost

**Common causes / Nguyên nhân**

1. SSL cert paths reference a cert that does not exist yet (block 443 added before running `certbot`).
2. Duplicate `server_name` across vhosts.
3. Trailing `;` missing on a directive.

**Fix —** Start with HTTP-only (no `listen 443` block), reload, run `sudo certbot --nginx -d <subdomain>`; certbot adds the 443 block + redirect itself.

```bash
sudo nginx -t        # shows the exact line
```

### 502 Bad Gateway

**EN —** Nginx is up but cannot reach the container.

**VN —** Nginx chạy nhưng không gọi được container.

**Checks / Kiểm tra**

```bash
curl -I http://127.0.0.1:3003                # container responding?
docker compose ps                             # container Up?
docker compose logs --tail=50                 # any errors?
sudo ss -tlnp | grep 3003                    # nginx and docker on same port?
```

If container is up and responds on 3003, the `proxy_pass` URL is probably wrong — must be `http://localhost:3003`, not `https://`.

### 413 Request Entity Too Large

**EN —** Nginx default body size is 1 MB. Uploaded Excel files often exceed this.

**VN —** Body size mặc định của Nginx là 1 MB. File Excel upload thường lớn hơn.

**Fix —** The shipped vhost already sets `client_max_body_size 50M;`. If still failing, also check the in-app cap (`maxDuration` and request handling).

---

## App-level

### "Too many barcodes (N)" 400 error

**EN —** Hard cap of 200 barcodes per request, set in [`app/api/check/route.ts`](../app/api/check/route.ts). Split the batch client-side.

**VN —** Giới hạn cứng 200 barcode mỗi request, đặt trong [`app/api/check/route.ts`](../app/api/check/route.ts). Chia batch nhỏ ở phía client.

### All layers return UNKNOWN

**EN —** Outbound network blocked from the container. Test:

```bash
docker compose exec checkbarcode sh -c "wget -O- https://api.upcitemdb.com/prod/trial/lookup?upc=0123456789012"
```

If this fails, the container has no DNS or no internet — check the Docker network and host firewall.

**VN —** Container không gọi ra Internet được. Test bằng lệnh trên — nếu fail thì container thiếu DNS hoặc Internet. Check Docker network + firewall host.

### Web layer is slow (>5s per barcode)

**EN —** DuckDuckGo HTML endpoint becomes slow under load and occasionally rate-limits silently. Options:

- Lower the timeout in [`lib/providers/http.ts`](../lib/providers/http.ts) so the layer fails fast → returns UNKNOWN.
- Disable the layer (remove from `PROVIDERS` array) if web footprint signal isn't valued.
- Swap to a paid search API (SerpAPI, Brave Search) in `lib/providers/web.ts`.

**VN —** Endpoint HTML của DuckDuckGo chậm khi tải, đôi khi bị rate-limit ngầm. Cách xử:

- Hạ timeout trong [`lib/providers/http.ts`](../lib/providers/http.ts) để layer fail nhanh → trả UNKNOWN.
- Bỏ layer (xoá khỏi mảng `PROVIDERS`) nếu không cần web footprint.
- Đổi sang search API trả phí (SerpAPI, Brave Search) trong `lib/providers/web.ts`.

---

## How to read logs / Cách đọc log

**EN —** Every provider prefixes its console output with `[<provider-id>]`. The interesting lines:

```
[amazon] LWA token exchange: POST https://api.amazon.com/auth/o2/token
[amazon] LWA token OK (expires_in=3600s)
[amazon] Catalog request: GET .../catalog/2022-04-01/items?... (gtin=..., type=EAN, marketplace=...)
[amazon] Catalog response: HTTP 200 (x-amzn-RequestId=<id>)
[amazon] Catalog parsed: numberOfResults=3 items=3
```

On failure, the response body is logged in full (≤2000 chars) so Amazon's error message is visible without rerunning. Save the `x-amzn-RequestId` if you need to escalate to Amazon SP-API Support — they can look up exactly which scope was denied.

**VN —** Mọi provider prefix log với `[<provider-id>]`. Các dòng quan trọng ở trên. Khi lỗi, response body được log đầy đủ (≤2000 ký tự) → thấy luôn message lỗi của Amazon mà không phải chạy lại. Lưu `x-amzn-RequestId` nếu cần escalate tới Amazon SP-API Support — họ tra được scope nào bị từ chối.
