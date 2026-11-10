# Màn bảo trì và báo có phiên bản mới (SPT-124)

Spec: `design/maintenance-plan.md` (mục 2, 2b). Bản vẽ: `design/screens/APP-maintenance-*.dc.html`, `APP-new-version-banner-*.dc.html`.

Code: `src/lib/appStatus.ts` (logic thuần), `src/components/AppStatus.tsx` (+ `.css`, `.test.tsx`). `App.tsx` bọc cả app bằng `<AppStatus>`, **ngoài** luồng đăng nhập, nên màn bảo trì hiện được cả khi API chết.

## Bảo trì
- Đọc `/maintenance.json` lúc mở app, mỗi 60 giây và khi quay lại tab (`visibilitychange`), không cache (`cache: 'no-store'`).
- Có file, JSON đọc được, không có `"enabled": false` → hiện màn bảo trì thay cho app. `{"message": "..."}` là lời nhắn (có thể bỏ trống).
- 404, lỗi mạng, hoặc 200 nhưng là HTML (nginx rơi về `index.html`) → coi như không bảo trì.
- Đang ở `/do-exam/*`: thêm dòng "Lượt làm bài đang dở đã được trả lại" (BE reset lượt khi bật bảo trì).
- Nút "Thử lại" kiểm tra lại ngay. FE **không** xử lý 503/504 của API.

## Phiên bản mới
- `vite.config.js` sinh `dist/version.json` = `{"version": "<mã>"}` và nhúng cùng mã vào bundle (`__APP_VERSION__`). Mã: biến môi trường `APP_VERSION` → git sha → thời điểm build (Docker build không có `.git`, nên rơi về thời điểm build; vẫn khác nhau mỗi lần build).
- Cùng nhịp 60 giây, so `/version.json` với `__APP_VERSION__`. Khác → dải "Đã có phiên bản mới" + nút "Tải lại" (không tự tải lại). Không hiện trong phòng thi; nộp xong sang trang kết quả thì hiện.
- `vite:preloadError` (chunk cũ đã bị xoá sau deploy): tự `location.reload()` **một lần** mỗi phiên tab, chặn lặp bằng `sessionStorage`. Storage bị chặn thì không tải lại.
- Dev server không có `version.json` → không bao giờ hiện dải.
