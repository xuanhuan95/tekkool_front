# viettestpro — Frontend

Web thi thử kỳ thi **SPT – Đánh giá năng lực ĐH Sư phạm Hà Nội**. Ba vai trò:

- **Học sinh:** đăng ký / đăng nhập, xem đề theo môn, mua gói lượt (SePay), làm bài cả đề trên một trang, xem kết quả, xem lại bài, lịch sử, xếp hạng tuần / thành tích, danh hiệu, tài khoản.
- **Giáo viên:** soạn đề (editor, import .docx, rút từ ngân hàng), chấm tự luận — **giao diện cũ (Semantic UI)**, reskin ở sprint sau.
- **Admin:** giáo viên, người dùng, gói & giá, doanh thu, giao dịch & đối soát (`/manage/*`).

Backend: repo `tekkool_back` (Flask, API dạng `/api/<module>/<hàm>`, token qua `?token=`).

## Stack

| | |
|---|---|
| UI | React 18 + TypeScript (strict), Vite 6 |
| Gọi API | `src/services/api.ts` (fetch, token, lỗi có `code`; phiên hết hạn → xem dưới) + `@tanstack/react-query` (hook trong `src/queries/`) |
| State client | zustand (`src/stores/`) — chỉ state của client, dữ liệu server để react-query giữ |
| Router | react-router-dom 6 |
| Nội dung đề | DOMPurify + html-react-parser (`SafeHtml`), KaTeX cho công thức, TipTap cho ô soạn thảo |
| Giao diện mới | bộ component "Sổ tay" (design D) ở `src/components/ui/` — không dùng Semantic UI |
| Test | vitest + @testing-library/react (jsdom) |

## Cấu trúc `src/`

```
src/
  index.tsx, pages/App.tsx     điểm vào; chọn view theo đăng nhập/vai trò
  pages/AuthenticateView.tsx   bảng route sau đăng nhập (HS, GV); Admin → pages/manage/ManageApp.tsx
  pages/AnonymousView.tsx      đăng nhập / đăng ký        pages/VisitorView.tsx  tài khoản visitor
  components/ui/               bộ component design D (+ layout/, exam/) — xem docs/components.md
  components/                  thành phần dùng chung cũ: SafeHtml, Passage, Editor (TipTap), OutOfTurnsModal…
  pages/exam/                  phòng thi, kết quả, xem lại, lịch sử (SPT-16/17)
  pages/hs/, pages/student/    màn học sinh: trang chủ, đề thi, chi tiết đề, xếp hạng, tài khoản
  pages/pay/, pages/payment/   gói thi, xác nhận thanh toán SePay, kết quả thanh toán, lịch sử mua
  pages/manage/                Admin
  pages/exam-creation/, pages/my/, pages/dashboard/, pages/question-bank/   màn Giáo viên (cũ)
  pages/dev/                   /dev/ui — catalogue component (chỉ khi dev)
  queries/                     hook react-query theo miền + gọi API có tác dụng phụ (examSession.ts)
  services/api.ts              lớp transport duy nhất
  lib/format.ts                định dạng điểm, tiền, ngày giờ (giờ VN), chữ
  styles/tokens.css            token --vt-*; styles/fonts-d.css font tự host
  types/                       kiểu dữ liệu BE trả về
```

## Chạy

Cần Node 22.

```bash
npm ci                                              # cài đúng theo package-lock
VITE_API_URL=http://127.0.0.1:5000/api/ npx vite    # dev, cổng 3000 (dấu / cuối là bắt buộc)
npx vite build                                      # bản build vào dist/
npx tsc --noEmit -p .                               # kiểm kiểu
npx vitest run                                      # chạy test (npx vitest = chế độ theo dõi)
```

- Không đặt `VITE_API_URL` thì FE gọi `https://api.tekkool.com/api/` (production) — xem `src/settings.ts`.
- Trang catalogue component: `http://localhost:3000/dev/ui` (chỉ có ở dev, không vào bản build).
- Chạy kèm backend thật trên mongomock để thử end-to-end: `tests_qc/devstack/up.sh` trong repo backend.

Trước khi báo xong một task: `tsc`, `vitest`, `vite build` đều phải sạch — CI (GitHub Actions) chạy đúng 3 lệnh này
trên mọi PR.

## Tên app và icon (SPT-74)

Tên app là **viettestpro** (chữ thường): `<title>` trong `index.html`, `name`/`short_name` trong `public/manifest.json`, tiêu đề các thanh đầu trang.
Icon "vt" (phương án D): `public/icon.svg` là bản đầy đủ có ngôi sao (nguồn của `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`);
`public/favicon.svg` và `favicon.ico` (16/32/48) là bản nhỏ không sao, viền dày. Chữ "vt" đã đổi sang path (outline từ Patrick Hand) nên không cần tải font.
`theme_color` / `background_color` = `#f5f6ee` (nền giấy). Muốn đổi icon: sửa SVG rồi xuất lại các PNG/ICO từ SVG (dùng resvg), đừng sửa PNG bằng tay.

## Deploy

Merge PR vào `main` → GitHub Actions tự test và deploy lên server (`.github/workflows/deploy.yml`).
Cài đặt và rollback: [docs/ci-cd.md](docs/ci-cd.md) (bản đầy đủ ở repo backend `docs/ci-cd.md`).
`tekkool-deploy/deploy.sh front` vẫn dùng được khi khẩn cấp.

## Quy ước

- Nhánh: `feature/SPT-<id>-mo-ta`, `fix/SPT-<id>-mo-ta`, `docs/SPT-<id>-mo-ta`. Không commit thẳng lên `main`; merge do PM sau khi anh Thịnh duyệt.
- Commit: `feat|fix|refactor|test|docs|chore(<phạm vi>): mô tả [SPT-<id>]`, phạm vi thường dùng `hs`, `admin`, `ui`.
- Quy tắc code chi tiết (TypeScript strict, zustand, react-query, function component, định danh tiếng Anh / chữ hiển thị tiếng Việt): [RULES.md](RULES.md). Ca test bắt buộc theo luồng: [TESTING.md](TESTING.md).

## Tài liệu

Mục lục ở [docs/README.md](docs/README.md): design system, component, bản đồ route, luồng màn làm bài.

## Phiên đăng nhập hết hạn (SPT-71)

Khi BE trả 400 `Session does not exist` / `Token is not valid` / `Token is required` cho người **đã đăng nhập**,
`api.ts` (`_call` và `upload`) gọi handler do `authStore` đăng ký: xoá token, đặt cờ `sessionStorage.sessionExpired`,
tải lại `/`. `init()` lúc này không còn token nên không lặp; màn Đăng nhập đọc cờ một lần và hiện
"Phiên đăng nhập đã hết, vui lòng đăng nhập lại.". Người chưa đăng nhập (đăng nhập thử lại bằng `loginWithRetry`) không bị chuyển trang.
Màn tải dữ liệu hiển thị lý do thật bằng `errorText(error, …)`, không che thành "kiểm tra mạng".
