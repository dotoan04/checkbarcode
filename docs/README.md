# Barcode Risk Checker — Documentation

**EN —** Documentation index for the Barcode Risk Checker. The tool assesses whether a GTIN/EAN/UPC barcode is safe to reuse for a new product listing, by checking the barcode against multiple independent data sources and aggregating the signals into a verdict.

**VN —** Mục lục tài liệu cho công cụ Barcode Risk Checker. Tool đánh giá xem một barcode GTIN/EAN/UPC có an toàn để dùng cho listing sản phẩm mới hay không, bằng cách kiểm tra qua nhiều nguồn dữ liệu độc lập rồi tổng hợp tín hiệu thành kết luận.

---

## Documents / Danh sách tài liệu

| File | EN | VN |
|---|---|---|
| [overview.md](overview.md) | Project overview, problem, solution shape | Tổng quan dự án, vấn đề, hướng giải quyết |
| [architecture.md](architecture.md) | Pipeline, layers, data sources, scoring engine | Pipeline, các lớp, nguồn dữ liệu, công cụ chấm điểm |
| [usage-guide.md](usage-guide.md) | How to use the web UI + REST API | Hướng dẫn dùng web UI và REST API |
| [configuration.md](configuration.md) | `.env` keys, `lib/config.ts`, brand setup | Các biến môi trường, file config, cài đặt brand |
| [deployment.md](deployment.md) | Docker, Nginx, SSL, ops runbook | Triển khai Docker, Nginx, SSL, vận hành |
| [troubleshooting.md](troubleshooting.md) | Common errors, Amazon SP-API gotchas | Các lỗi thường gặp, gotcha của Amazon SP-API |

---

## Quick start / Bắt đầu nhanh

```bash
# Local dev
npm install
cp .env.example .env.local      # fill in any credentials you have
npm run dev                      # http://localhost:3000

# Production (Docker)
docker compose up -d --build
```

**EN —** Without any credentials configured the tool still runs — keyless layers (UPCitemdb, public GS1, DuckDuckGo) cover the basics; layers without credentials simply report `UNKNOWN`.

**VN —** Không có credentials tool vẫn chạy được — các layer không cần key (UPCitemdb, GS1 public, DuckDuckGo) cover phần cơ bản; layer thiếu credentials chỉ trả `UNKNOWN` chứ không lỗi.
