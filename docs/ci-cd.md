# CI/CD frontend — GitHub Actions (SPT-67)

Bản đầy đủ (sơ đồ luồng, **hướng dẫn cài đặt một lần**, rollback, sự cố, ops): `docs/ci-cd.md` trong repo
**tekkool_back**. File này chỉ ghi phần riêng của frontend.

## Luồng

```
Nhánh ──push / PR──> ci.yml: npm ci → tsc → vitest → vite build ──> anh review ──> Merge main
                                                                                │
deploy.yml: CI lại trên main ──(xanh)──> rsync vào <DEPLOY_PATH>/front/ ──> docker compose build front + up -d front
           ──> kiểm tra SITE_URL: / = 200, /admin = 404 (thử lại ~30 giây)
```

| File | Chạy khi | Làm gì |
|---|---|---|
| `.github/workflows/ci.yml` | PR, push nhánh (trừ main), gọi từ deploy | Node 22: `npm ci`, `npx tsc --noEmit -p .`, `npx vitest run`, `npx vite build` (`VITE_API_URL=/api/` như `Dockerfile.front`) |
| `.github/workflows/deploy.yml` | Push `main` (merge PR), hoặc Run workflow | Như `tekkool-deploy/deploy.sh front`: rsync (loại `node_modules`, `.git`, `.github`, `dist`, `build`, `deploy`) → build image front (npm ci + vite build trong Docker) → up → kiểm tra |
| `.github/actions/deploy-ssh` | Bước trong deploy | Kiểm secrets/variables, SSH ghim host key (`StrictHostKeyChecking yes`), kiểm `.env*` trên server |
| `.github/scripts/health_check.sh` | Bước trong deploy | Giống hệt file cùng tên ở backend; deploy FE đặt `CHECK_API=0` |

- `concurrency: deploy-prod`, không huỷ deploy đang chạy. Chỉ cần repository secrets/variables — không dùng Environments
  (repo private gói Free không có); muốn duyệt trước khi deploy: xem Bước 4 (tuỳ chọn) ở bản đầy đủ.
- `tekkool-deploy/deploy.sh front` (chạy tay) vẫn dùng được khi khẩn cấp hoặc khi đổi `nginx.conf` / `Dockerfile.front`.

## Cấu hình cần tạo trong repo này

Settings → Secrets and variables → Actions (cách lấy giá trị: xem bản đầy đủ ở backend, Bước 1–6):

- **Secrets:** `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` (cùng giá trị với repo backend).
- **Variables:** `DEPLOY_HOST` (`161.118.222.140`), `DEPLOY_USER` (`ubuntu`), `DEPLOY_PATH` (`/opt/tekkool`, có thể bỏ trống),
  `DEPLOY_ENV_FILE` (`.env.prod` hoặc `.env` — bắt buộc), `SITE_URL` (`https://entclinic.cloud`).
- **Quyền:** cần quyền **Admin** repo (thấy tab Settings); không có thì nhờ chủ repo `xuanhuan95` cấp (Settings → Collaborators and teams) hoặc tự thêm.
- Bảo vệ nhánh `main` có thể không bật được trên repo private gói Free → quy ước **chỉ merge qua PR có CI ✓**.

## Rollback

Actions → **Deploy frontend** → lần chạy xanh trước → **Re-run all jobs**; hoặc Revert PR rồi merge.
Sau deploy người dùng có thể cần Ctrl/Cmd+Shift+R để bỏ cache trình duyệt.
