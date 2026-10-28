# Tài liệu frontend viettestpro

| File | Nội dung |
|---|---|
| [design-system.md](design-system.md) | Design system "Sổ tay" (hướng D) — chép từ nguồn chuẩn của Athena, kèm mục "Trong code" (token, font, quy tắc) |
| [components.md](components.md) | Component trong `src/components/ui`: props chính, ví dụ, khi nào dùng |
| [routes.md](routes.md) | Bản đồ route theo vai trò: màn ↔ file ↔ artboard design ↔ API |
| [ci-cd.md](ci-cd.md) | CI/CD GitHub Actions: kiểm tra PR, deploy khi merge `main`, cấu hình cần tạo, rollback |
| [lam-bai.md](lam-bai.md) | Luồng màn làm bài: tải đề, gom Đúng/Sai, tự lưu khi mất mạng, đồng hồ, nộp, lỗi 402/409, F5, `lam_lai` |
| [cham-tren-anh.md](cham-tren-anh.md) | Chấm tự luận trên ảnh bài làm (SPT-84): dấu ✓ / ✗ / ghi chữ, toạ độ %, xoay, điện thoại, học sinh xem lại |

Ngoài thư mục này: [../README.md](../README.md) (chạy, cấu trúc), [../RULES.md](../RULES.md) (quy tắc code), [../TESTING.md](../TESTING.md) (ca test theo luồng).

Design gốc (HTML từng màn): `design/screens/*.dc.html` trong repo dự án — mobile 390px, `HS-Web-*` cho web ≥1024px.
