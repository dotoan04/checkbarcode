# Deployment / Triển khai

## Target environment / Môi trường mục tiêu

**EN —** This document describes the current production deployment on the MBC staging server: Ubuntu/Debian + Docker + Nginx reverse proxy + Let's Encrypt SSL, app served on a subdomain of `mbcstaging.com`.

**VN —** Tài liệu này mô tả deployment hiện tại trên staging server của MBC: Ubuntu/Debian + Docker + Nginx reverse proxy + SSL Let's Encrypt, app phục vụ qua subdomain của `mbcstaging.com`.

## Prerequisites / Điều kiện cần

- Linux server with `docker` + `docker compose` v2 installed
- Nginx already serving other sites at `/etc/nginx/sites-available/mbc`
- Certbot with `nginx` plugin (`apt install certbot python3-certbot-nginx`)
- DNS control over the parent domain
- A free TCP port for the container (default in this project: **3003**)

## Build artifacts / Cấu trúc build

The repo ships with:

```
Dockerfile              multi-stage build: deps → builder → runner
.dockerignore           keep node_modules, .next, .git out of build context
docker-compose.yml      single-service compose definition, port 3003 → container 3000
next.config.mjs         output: "standalone" → minimal runtime image
```

**EN —** The Dockerfile uses Next.js `standalone` output: the final image bundles only what's needed (server.js + minimal node_modules + .next/static), no need to copy the full `node_modules/`. Final image is ~200 MB; idle memory ~150-300 MB.

**VN —** Dockerfile dùng output `standalone` của Next: image cuối chỉ gom đủ thứ cần (server.js + node_modules tối thiểu + .next/static), không phải copy full `node_modules/`. Image cuối ~200 MB; RAM lúc rỗi ~150-300 MB.

## First-time deploy / Lần đầu deploy

### 1. Clone & configure / Clone & cấu hình

```bash
ssh corgi@<server>
cd /home
sudo git clone https://github.com/dotoan04/checkbarcode
cd checkbarcode
sudo chown -R corgi:corgi .            # so subsequent git/docker ops don't need sudo
```

Create `.env`:

```bash
nano .env
```

```dotenv
# Amazon SP-API (AU marketplace)
AMAZON_SP_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_SP_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
AMAZON_SP_REFRESH_TOKEN=Atzr|xxxxxxxxxxxxxxxxxxxxxxxxxxxx
AMAZON_SP_MARKETPLACE_ID=A39IBJ37TRP1C6
AMAZON_SP_ENDPOINT=https://sellingpartnerapi-fe.amazon.com

# Optional
GS1_API_KEY=
GOOGLE_MERCHANT_ID=
GOOGLE_OAUTH_TOKEN=
```

### 2. Build & run / Build & chạy

```bash
docker compose up -d --build
docker compose logs -f                  # confirm "✓ Ready" log line
docker compose ps                       # container should be Up (healthy)
curl -I http://127.0.0.1:3003           # should return 200
```

### 3. Nginx vhost / vhost Nginx

Append to `/etc/nginx/sites-available/mbc`:

```nginx
# barcode.mbcstaging.com → checkbarcode (port 3003)
server {
    server_name barcode.mbcstaging.com;

    access_log /var/log/nginx/checkbarcode_access.log;
    error_log  /var/log/nginx/checkbarcode_error.log;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;

        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    listen 80;
    listen [::]:80;
}
```

Reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 4. DNS / DNS

Add an A record on the DNS provider:

```
Name:  barcode
Type:  A
Value: <server public IP>
TTL:   Auto
```

Verify propagation:

```bash
dig barcode.mbcstaging.com +short       # should return server IP
```

### 5. SSL / SSL

```bash
sudo certbot --nginx -d barcode.mbcstaging.com
# When asked: "Redirect HTTP traffic to HTTPS?" → choose 2 (Redirect)
```

Certbot edits the vhost in place to add the `listen 443 ssl` block, `ssl_certificate` paths, and a separate redirect block. Auto-renewal is installed as a systemd timer.

Verify:

```bash
curl -I https://barcode.mbcstaging.com
sudo certbot certificates
sudo certbot renew --dry-run
```

## Update / redeploy / Cập nhật / redeploy

```bash
cd /home/checkbarcode
git pull
docker compose up -d --build            # rebuild + restart, ~5s downtime
docker image prune -f                   # clean dangling images
docker compose logs -f --tail=100       # confirm clean restart
```

**EN —** No DB migration steps — the app is stateless. State lives only in `.env` (credentials) and the source tree (config).

**VN —** Không có bước migrate DB — app stateless. State chỉ ở `.env` (credentials) và source (config).

## Operations / Vận hành

### Logs / Log

```bash
docker compose logs -f                                 # follow live
docker compose logs --tail=500                         # recent 500 lines
docker compose logs --since=10m | grep '\[amazon\]'    # last 10 min, Amazon layer only
```

**EN —** Each provider prefixes its console output with `[<id>]` (e.g. `[amazon] Catalog response: HTTP 403 ...`). Errors include the full response body (≤2000 chars) so 403/429 root causes are visible without re-running.

**VN —** Mỗi provider prefix log với `[<id>]` (vd `[amazon] Catalog response: HTTP 403 ...`). Lỗi gồm cả response body đầy đủ (≤2000 ký tự) → biết được nguyên nhân 403/429 mà không phải chạy lại.

Nginx logs:

```bash
sudo tail -f /var/log/nginx/checkbarcode_access.log
sudo tail -f /var/log/nginx/checkbarcode_error.log
```

### Resource monitoring / Theo dõi tài nguyên

```bash
docker stats checkbarcode               # live CPU/mem
docker compose ps                       # health check status
```

Healthcheck is defined in [`docker-compose.yml`](../docker-compose.yml): pings `http://127.0.0.1:3000/` every 30s inside the container. If three checks fail consecutively, status flips to `unhealthy` (still running, but flagged in `ps`).

### Rollback / Quay lui

```bash
cd /home/checkbarcode
git log --oneline -10                   # find the previous good commit
git checkout <commit-sha>
docker compose up -d --build
# back to head when issue is fixed:
git checkout master
```

**EN —** Because the image is built locally and not pushed to a registry, rollback always involves rebuilding from the previous commit. If you need instant rollback, push images to a registry (Docker Hub, GHCR) and use tagged image pulls instead of local build.

**VN —** Vì image build local không push lên registry, rollback luôn phải rebuild từ commit cũ. Nếu cần rollback tức thì, push image lên registry (Docker Hub, GHCR) và pull theo tag thay vì build local.

### Restart only / Chỉ restart

```bash
docker compose restart checkbarcode     # without rebuild
```

### Stop / Tạm dừng

```bash
docker compose down                     # stop + remove container, keep image
docker compose down --rmi local         # also remove the built image
```

## Port conflicts / Đụng port

**EN —** The server already runs many containers (see `sudo ss -tlnp`). If port 3003 is taken later, edit [`docker-compose.yml`](../docker-compose.yml):

```yaml
ports:
  - "3003:3000"     # ← change the left side to a free port
```

…and update `proxy_pass http://localhost:3003;` in the Nginx config to match. Then `nginx -t && systemctl reload nginx` + `docker compose up -d`.

**VN —** Server đã chạy nhiều container (xem `sudo ss -tlnp`). Nếu sau này port 3003 bị chiếm, sửa [`docker-compose.yml`](../docker-compose.yml):

```yaml
ports:
  - "3003:3000"     # ← đổi số bên trái sang port trống
```

…và sửa `proxy_pass http://localhost:3003;` trong Nginx config cho khớp. Rồi `nginx -t && systemctl reload nginx` + `docker compose up -d`.

## Security notes / Bảo mật

**EN —**
- The container binds to `0.0.0.0:3003` to match the pattern of other internal apps on this server. For external-facing or sensitive workloads, change to `127.0.0.1:3003:3000` so only Nginx (loopback) can reach it.
- `.env` should be `chmod 600`. Anyone who can read it has Amazon SP-API access.
- Refresh tokens never expire automatically on Amazon's side, but Amazon can revoke them. Rotate annually as part of routine credential hygiene.
- The image runs as a non-root user (`nextjs:nodejs`, uid 1001) — no need to map a host user.

**VN —**
- Container bind `0.0.0.0:3003` để đồng nhất với các app nội bộ khác. Với workload nhạy cảm / public hơn, đổi sang `127.0.0.1:3003:3000` để chỉ Nginx (loopback) gọi được.
- `.env` nên `chmod 600`. Ai đọc được file là có quyền dùng Amazon SP-API.
- Refresh token Amazon không tự hết hạn nhưng Amazon có thể revoke. Xoay vòng credentials mỗi năm theo thông lệ.
- Image chạy bằng user non-root (`nextjs:nodejs`, uid 1001) — không phải map user host.

## Where things live on the server / File ở đâu trên server

| Path | Purpose |
|---|---|
| `/home/checkbarcode/` | Source tree (cloned repo) |
| `/home/checkbarcode/.env` | Credentials (not committed) |
| `/etc/nginx/sites-available/mbc` | Nginx vhost (shared with other MBC apps) |
| `/etc/letsencrypt/live/barcode.mbcstaging.com/` | SSL cert + key |
| `/var/log/nginx/checkbarcode_*.log` | Nginx access/error log |
| `docker logs` | App console output (Amazon/GS1 layer traces) |
