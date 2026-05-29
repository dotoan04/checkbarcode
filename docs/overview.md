# Overview / Tổng quan

## The problem / Vấn đề

**EN —** A retail product needs a globally unique GTIN (barcode) to be listed on marketplaces (Amazon, Walmart, Shopee...) and to appear consistently in distributors' systems. Three common scenarios put a company at risk:

1. **Bought-back barcodes** — many small brands purchase GS1 barcodes from resellers (Barcodestalk, Speedy Barcodes, etc.) instead of from GS1 directly. These codes were originally issued in the 1990s under a US prefix and were never properly transferred. The original prefix owner remains in the GS1 Registry. When the company tries to use one for a new SKU, Amazon's automated check sees a name mismatch and flags the listing.
2. **Recycled barcodes** — even legitimate GS1-licensed barcodes can be reused after a product is retired. Stale listings, cached marketplace pages, and Google Manufacturer Center brand associations can persist, causing conflicts when a different product is launched on the same code.
3. **Brand-conflicting codes** — a barcode may technically be free but is already publicly associated with another brand on the web, in product databases, or in search engines. Listing under that code invites trademark issues.

**VN —** Một sản phẩm thương mại cần một GTIN (mã vạch) duy nhất toàn cầu để lên sàn (Amazon, Walmart, Shopee...) và xuất hiện nhất quán trong hệ thống nhà phân phối. Ba tình huống phổ biến đặt công ty vào rủi ro:

1. **Barcode mua lại** — nhiều brand nhỏ mua GS1 barcode từ reseller (Barcodestalk, Speedy Barcodes...) thay vì mua trực tiếp từ GS1. Các code này ban đầu được phát hành dưới prefix Mỹ thập niên 90 và chưa bao giờ được chuyển nhượng đúng cách. Chủ prefix gốc vẫn còn trong GS1 Registry. Khi công ty dùng cho SKU mới, Amazon kiểm tra tự động thấy không khớp tên → flag listing.
2. **Barcode tái sử dụng** — kể cả barcode mua chính thức từ GS1 cũng có thể bị reuse sau khi sản phẩm bị retire. Listing cũ, cache marketplace, brand association trong Google Manufacturer Center vẫn còn → khi launch sản phẩm khác trên code cũ sẽ bị conflict.
3. **Code đụng brand** — một barcode có thể "trống" về kỹ thuật nhưng đã gắn công khai với brand khác trên web, trong database sản phẩm, trong search engine → list dưới code đó dễ dính vấn đề thương hiệu.

## The solution / Hướng giải quyết

**EN —** This tool runs each barcode through **five independent layers** before listing. Each layer answers one specific question; layers are intentionally redundant so a missing or rate-limited source does not produce a false "safe". A weighted scoring engine fuses the layers into a single verdict: **SAFE / WARNING / DANGER / INVALID**.

**VN —** Tool chạy mỗi barcode qua **5 lớp độc lập** trước khi list. Mỗi lớp trả lời một câu hỏi cụ thể; các lớp cố tình chồng chéo để khi một nguồn miss hoặc bị rate-limit, kết quả tổng vẫn không bị "an toàn giả". Một bộ chấm điểm có trọng số gom các lớp thành một kết luận duy nhất: **SAFE / WARNING / DANGER / INVALID**.

| Layer / Lớp | Question / Câu hỏi |
|---|---|
| 0 — Validation | Is the GTIN structurally valid? / Mã có hợp lệ về cấu trúc? |
| 1 — GS1 ownership | Who registered this GTIN? / Ai đăng ký GTIN này? |
| 2 — UPCitemdb | Is there already a known product / marketplace offer? / Đã có sản phẩm / offer marketplace nào? |
| 2b — Amazon SP-API | Is there an active Amazon listing in our marketplace? / Có listing Amazon nào đang sống trên marketplace của chúng ta? |
| 3 — Google Content API | Is the code claimed in Google Merchant Center? / Code đã bị claim trong Google Merchant Center? |
| 4 — Web footprint | Does the code appear anywhere on the public web? / Code có xuất hiện ở đâu trên web công khai? |

See [architecture.md](architecture.md) for how each layer works and how the scoring engine fuses them.

Xem [architecture.md](architecture.md) để biết chi tiết từng lớp và cách bộ chấm điểm tổng hợp.

## Who is this for / Đối tượng sử dụng

**EN —** The tool is built for product / e-commerce / brand-protection teams at companies that:
- Buy bulk barcodes from resellers and want to know which ones are actually safe to list.
- Manage a long-tail catalog and need to vet barcodes before assigning them to new SKUs.
- Want to pre-screen barcodes before submitting to Amazon Brand Registry to avoid suppression.

The default brand identity in [`lib/config.ts`](../lib/config.ts) is `MaxBiocare` — edit `ownCompanyName` and `ownBrandNames` to match the company that owns this deployment.

**VN —** Tool dành cho team product / e-commerce / brand-protection ở các công ty:
- Mua barcode số lượng lớn từ reseller và muốn biết code nào thực sự an toàn để list.
- Quản lý catalog long-tail, cần kiểm tra barcode trước khi gán cho SKU mới.
- Muốn pre-screen barcode trước khi submit lên Amazon Brand Registry để tránh bị suppress.

Brand mặc định trong [`lib/config.ts`](../lib/config.ts) là `MaxBiocare` — sửa `ownCompanyName` và `ownBrandNames` cho khớp công ty đang deploy.

## What this tool is NOT / Tool này KHÔNG phải là

**EN —**
- Not a barcode **generator**. It does not create new GTINs; it only assesses existing ones.
- Not a substitute for a real GS1 license. If the company plans to scale, buying a GS1 Company Prefix directly is still the right long-term move.
- Not an "Amazon listing checker" by itself — SP-API only covers the marketplace your seller account is registered in. For global Amazon coverage, combine with the UPCitemdb layer.
- Not a real-time monitor. It is a point-in-time risk assessment; results can change if a marketplace adds or removes listings.

**VN —**
- Không phải tool **sinh** barcode. Tool chỉ đánh giá code có sẵn, không tạo GTIN mới.
- Không thay thế được việc mua GS1 thật. Nếu công ty định scale, mua GS1 Company Prefix trực tiếp vẫn là hướng đúng về lâu dài.
- Không tự nó là "Amazon listing checker" — SP-API chỉ cover marketplace mà seller account đăng ký. Muốn cover Amazon toàn cầu phải kết hợp thêm layer UPCitemdb.
- Không phải monitor real-time. Đây là đánh giá rủi ro tại một thời điểm; kết quả có thể đổi nếu marketplace thêm/bớt listing.
