# viettestpro — Design system "Sổ tay" (hướng D, chốt 21/10/2026)

> Bản trực quan: canvas "viettestpro — Design system & màn hình" trên claude.ai (https://claude.ai/artifact/GroubnGHCqBQq39mscjidU) — 4 trang: Design system, Học sinh (24 màn), Giáo viên (11), Admin (4).
> Đề mẫu dùng thống nhất: Toán — Đề thi thử SPT số 3, 90 phút, 23 câu, 10 điểm (Phần I 12×0,25 · II 4×≤1 · III 6×0,25 · IV 1 tự luận 1,5).

Sản phẩm: web thi thử kỳ thi **SPT – Đánh giá năng lực ĐH Sư phạm Hà Nội**. Tên hiển thị: **viettestpro** (viết thường).
Cảm giác: cuốn sổ ôn thi — giấy chấm, tiêu đề viết tay, khối viền mực vẽ tay. Cổ điển, nhẹ, rõ ràng.
Màn làm bài: nền trắng phẳng, yên tĩnh, chỉ giữ chữ viết tay cho số câu và đồng hồ.

## 1. Tokens

| Token | Giá trị | Dùng cho |
|---|---|---|
| ink | `#1C1917` | viền, chữ chính, icon |
| muted | `#57534E` | chữ phụ (đạt 4.5:1 trên giấy và trắng) |
| paper | `#F5F6EE` | nền trang (kèm chấm) |
| dot | `#D9DBCF` | chấm nền: `background-image: radial-gradient(#d9dbcf 1px, transparent 1px); background-size: 20px 20px` |
| card | `#FFFFFF` | thẻ, ô nhập |
| line-soft | `#E7E5DC` | đường kẻ trong bảng/thẻ |
| action | `#D0E9FD` | nút chính, mục đang chọn, đáp án đang chọn, dòng "Bạn" |
| action-ink | `#1C1917` | chữ trên nút chính |
| title-bg / title-ink / title-icon | `#E5DCFB` / `#4A347F` / `#6B4FC8` | danh hiệu, nhãn thành tích |
| sun | `#FAAD05` | sao, thanh tiến độ, đánh dấu "xem lại" |
| sun-soft / sun-ink | `#FFFBDB` / `#7A4B00` | nền nhãn "đang làm dở", "chờ chấm" |
| track | `#EFEFEC` | nền thanh tiến độ |
| ok-bg / ok-ink | `#E7F6EC` / `#166534` | đúng, đã chấm, thanh toán thành công |
| err | `#B42318`, err-bg `#FDECEA` | sai, lỗi, hết giờ, thất bại |
| medal | vàng `#FBF5BB` viền `#E8C45C`; bạc `#FFFFFF` viền `#B9B9BD`; đồng `#FDE9D0` viền `#C98D6C` | top 1–3 |

Không dùng gradient, không bóng mờ, không emoji.

## 2. Chữ

- Font: `<link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">` trong `<helmet>`.
- **Patrick Hand, luôn `font-weight: 700`** (`font-family: 'Patrick Hand', cursive; font-weight: 700`): tiêu đề trang (32–44px), tiêu đề thẻ (22–28px), con số lớn (điểm, lượt, đồng hồ 28–48px), tab, menu điều hướng (18–20px), ô thống kê trên header (19px). **Không dùng dưới 18px. Không dùng cho nội dung câu hỏi, đáp án, bảng, đoạn văn.**
- **Inter**: mọi thứ còn lại. Thân 15–16px, dòng 1.6 cho đề thi; phụ 13px màu muted; nhãn 12px weight 600; số trong bảng `font-variant-numeric: tabular-nums`.

## 3. Nét vẽ tay (bo góc lệch)

Viền: `2px solid #1c1917`. Không dùng bo đều (trừ hình tròn và viên thuốc 999px).
- Thẻ lớn: `border-radius: 22px 16px 24px 14px / 14px 24px 16px 22px`
- Thẻ vừa: `border-radius: 16px 11px 18px 10px / 10px 18px 11px 16px`
- Nút, ô nhập: `border-radius: 13px 9px 14px 8px / 8px 14px 9px 13px`
- Nhãn, chip nhỏ: `border-radius: 8px 5px 9px 4px / 4px 9px 5px 8px`
- Ô thống kê header: `border-radius: 6px 4px 7px 3px / 3px 7px 4px 6px`
- Bóng: chỉ cho nút chính và ô thống kê: `box-shadow: 1px 2px 0 #1c1917`. Không bóng mờ.
- Đường gợn dưới header (SVG, không lặp đều): mobile `<svg width="350" height="8" viewBox="0 0 350 8" aria-hidden="true"><path d="M1 4 C 30 2, 58 6, 98 4 S 162 2, 204 5 S 272 6, 312 3 S 340 4, 349 4" fill="none" stroke="#1c1917" stroke-width="1.8" stroke-linecap="round"/></svg>`; web `<svg width="100%" height="10" viewBox="0 0 1280 10" preserveAspectRatio="none" aria-hidden="true" style="display: block; margin-top: 12px"><path d="M1 5 C 60 3, 120 7, 200 5 S 330 3, 410 6 S 540 7, 620 4 S 760 3, 840 6 S 980 7, 1060 4 S 1200 5, 1279 5" fill="none" stroke="#1c1917" stroke-width="1.8" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`

## 4. Thành phần (copy y nguyên style)

- **Nút chính**: `font-family: inherit; font-size: 15px; font-weight: 600; background: #d0e9fd; color: #1c1917; border: 2px solid #1c1917; border-radius: 13px 9px 14px 8px / 8px 14px 9px 13px; padding: 11px 18px; min-height: 46px; box-shadow: 1px 2px 0 #1c1917`
- **Nút phụ**: như trên nhưng `background: #ffffff`, không box-shadow.
- **Nút chữ / liên kết**: `font-size: 14px; font-weight: 600; color: #1c1917; text-decoration: underline; text-underline-offset: 3px`
- **Nút nguy hiểm**: nền `#ffffff`, viền và chữ `#b42318`.
- **Nút bị khoá**: nền `#efefec`, chữ `#57534e`, viền `#d9dbcf`, không bóng.
- **Ô nhập**: `<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600">Email<input ... style="font-family: inherit; font-size: 15px; background: #ffffff; border: 2px solid #1c1917; border-radius: 13px 9px 14px 8px / 8px 14px 9px 13px; padding: 11px 12px; color: #1c1917"></label>`. Lỗi: viền `#b42318` + dòng 13px màu `#b42318` bên dưới. Gợi ý: 13px muted.
- **Tab viên thuốc**: khung `display: inline-flex; background: #ecebe4; border-radius: 999px; padding: 4px; gap: 4px`; tab chọn `font-family: 'Patrick Hand', cursive; font-weight: 700; font-size: 18px; background: #ffffff; border: 2px solid #1c1917; border-radius: 999px; padding: 3px 14px; min-height: 36px`; tab khác giống nhưng `background: transparent; border: 2px solid transparent; color: #57534e`.
- **Công tắc**: rãnh 44×24 viền mực 2px bo 999px; bật: nền `#d0e9fd`, núm mực bên phải; tắt: nền trắng, núm viền mực bên trái.
- **Thẻ**: `background: #ffffff; border: 2px solid #1c1917;` + bo thẻ lớn; padding 20–24px.
- **Nhãn trạng thái** (12px, 600, padding 3px 9px, bo nhãn nhỏ): Đã chấm `#e7f6ec/#166534`; Chờ chấm, Đang làm dở `#fffbdb/#7a4b00` (+ `border: 1.5px solid #faad05` khi cần nổi); Lỗi/Thất bại `#fdecea/#b42318`; Nháp `#efefec/#57534e`; Phổ biến `#faad05`/chữ mực; Danh hiệu `#e5dcfb/#4a347f`.
- **Thanh tiến độ**: rãnh `height: 8px; border-radius: 999px; background: #efefec`, ruột `#faad05`.
- **Ô thống kê header**: `font-family: 'Patrick Hand', cursive; font-weight: 700; font-size: 19px; background: #ffffff; border: 2px solid #1c1917;` + bo ô thống kê + `padding: 5px 12px; display: flex; align-items: center; gap: 8px; box-shadow: 1px 2px 0 #1c1917`. Ba ô: danh hiệu (icon vương miện tím #6B4FC8), sao (#FAAD05), lượt (icon vé, viền xanh #2F6FB3).
- **Bảng**: trong thẻ; header 13px muted weight 500; dòng cách nhau `border-top: 1.5px solid #e7e5dc`; padding ô 12–14px; bảng rộng bọc `overflow-x: auto`.
- **Hộp thoại (modal)**: lớp phủ `rgba(28,25,23,.45)`; hộp trắng viền mực bo thẻ lớn, tiêu đề Patrick Hand 26px, nút phải dưới.
- **Toast**: thẻ nhỏ viền mực, icon trái, nền trắng; lỗi dùng viền đỏ.
- **Huy chương hạng**: vòng tròn 32px bo 999px, viền 2px màu huy chương, số Patrick Hand 18px.
- **Avatar**: tròn 36–40px viền mực, nền `#e5dcfb`, chữ cái đầu 13–14px 700.
- **Trạng thái rỗng**: icon nét 40px + câu Patrick Hand 22px + mô tả 14px muted + 1 nút. **Đang tải**: khối xám `#efefec` bo thẻ, không spinner xoay giữa trang. **Lỗi**: thẻ viền đỏ, câu giải thích + nút "Thử lại".

## 5. Thành phần làm bài (SPT)

- Header làm bài **dính** (`position: sticky; top: 0; z-index: 2; background: #ffffff; border-bottom: 2px solid #1c1917`): nút thoát 44px trái; đồng hồ giữa (Patrick Hand 30px trong khung viền mực; còn ≤5 phút: chữ và viền `#b42318`, nền `#fdecea`); nút "Nộp bài" (nút chính) phải. Dòng dưới: tên môn · tên đề, "x / N đã làm"; thanh tiến độ.
- Số câu: Patrick Hand 28px "Câu 12". Nút "Xem lại sau": nền `#fffbdb`, viền `#faad05`, chữ mực.
- **Trắc nghiệm 4 đáp án**: mỗi đáp án là `<button>` 54px cao, viền `1.5px solid #d6d3c4`, bo nút; chữ cái trong vòng tròn 28px viền `#a8a29e`. Đang chọn: nền `#d0e9fd`, viền `2px solid #1c1917`, vòng tròn nền mực chữ trắng. Có thể có ảnh/công thức trong đáp án.
- **Đúng/Sai 4 ý (a, b, c, d)**: mỗi ý một hàng: nội dung ý bên trái, bên phải 2 nút "Đ" và "S" (44×40, viền mực, chọn = nền `#d0e9fd` chữ đậm). Dưới tiêu đề câu có ghi chú 13px muted: "Đúng 1 ý 0,1đ · 2 ý 0,25đ · 3 ý 0,5đ · 4 ý 1đ".
- **Trả lời ngắn**: ô nhập 1 dòng, cỡ 18px, chỉ nhận kết quả; gợi ý 13px muted "Chỉ ghi kết quả, ví dụ: 2,5 hoặc -3".
- **Tự luận**: vùng soạn thảo nhiều dòng (min 220px) viền mực, thanh công cụ nhỏ (B, I, công thức, chèn ảnh), đếm chữ; ghi chú "Giáo viên sẽ chấm phần này".
- **Bảng danh sách câu**: lưới ô vuông 44px; đã làm: nền `#d0e9fd`; đang ở: viền mực 2px dày + chữ đậm; đánh dấu xem lại: chấm vàng góc; chưa làm: trắng viền `#d6d3c4`. Chú thích màu bên dưới. Nhóm theo phần (Phần I Trắc nghiệm, Phần II Đúng/Sai, Phần III Trả lời ngắn, Phần IV Tự luận).
- **Màn làm bài là MỘT trang cuộn hiển thị cả đề** (như đề giấy), trả lời ngay tại từng câu; KHÔNG có nút Câu trước/Câu sau. Dưới header dính có **dải số câu dính** cuộn ngang (bấm để nhảy tới câu) + nút "Tất cả câu" mở sheet "Đi tới câu". Cuối trang: khối "Hết đề" + nút "Nộp bài". "Đã lưu tự động lúc 20:41" 12px muted với dấu tích xanh `#15803d`. Web: cột phải sticky là bảng danh sách câu.
- Kết quả: điểm **thang 10**, Patrick Hand 64px "7,75 / 10"; nếu có tự luận chưa chấm: "Tạm tính 6,25 · chờ chấm 1,5đ tự luận".

## 6. Bố cục

- **Mobile (HS)**: artboard 390×844 cố định. Nền giấy chấm (trừ màn làm bài). Header dính trên cùng: logo "viettestpro" Patrick Hand 26px trái; phải: ô sao + ô lượt (cỡ nhỏ 14px) + avatar; đường gợn dưới. Nội dung giữa `flex-grow: 1; overflow-y: auto; padding: 14px 20px`. Thanh điều hướng dưới (`background: #ffffff; border-top: 2px solid #1c1917`), 4 mục Patrick Hand 18px: Trang chủ · Đề thi · Xếp hạng · Tôi; mục đang chọn nền `#d0e9fd` bo nhãn nhỏ.
- **Web (HS web, GV, Admin)**: PAGE fluid (`width: 100%; min-height: 960px`), nội dung `max-width: 1280px; margin: 0 auto; padding: 32px 24px`. Header dính: logo Patrick Hand 30px · menu Patrick Hand 20px (mục chọn nền `#d0e9fd`) · bên phải ô thống kê + avatar · đường gợn full ngang. Bố cục 2 cột: chính `flex: 999 1 560px; min-width: 0`, phụ `flex: 1 1 300px; max-width: 380px`, cả hàng `flex-wrap: wrap`.
- **Menu GV**: Tổng quan · Môn & đề · Ngân hàng câu hỏi · Chấm bài (giáo viên chỉ soạn đề và chấm bài). Ô thống kê GV: "3 bài chờ chấm" (vàng), avatar. Nhãn vai trò "Giáo viên" (nhãn danh hiệu tím).
- **Menu Admin**: Giáo viên · Học sinh · Gói thi · Doanh thu · Giao dịch (Admin quản lý gói và giá). Nhãn vai trò "Admin".
- Khoảng cách bội 4: 4/8/12/16/20/24/32. Vùng bấm ≥ 44px.

## 7. Nội dung mẫu (dùng thống nhất, không bịa số liệu thật)

- Học sinh: Minh Anh (avatar "MA"), còn **7 lượt** (lượt **không hết hạn**), 20 sao, danh hiệu "Học sinh chăm".
- Giáo viên: Cô Thu Hà ("TH"). Admin: "Quản trị viên".
- Môn SPT (12): Toán, Ngữ văn, Tiếng Anh, Vật lí, Hóa học, Sinh học, Lịch sử, Địa lí, Tin học, GD KT&PL, Công nghệ (CN), Công nghệ (NN). Mặc định thời gian: Toán, Ngữ văn 90 phút; môn khác 60 phút — **giáo viên chỉnh được**.
- Đề mẫu: "Toán — Đề thi thử SPT số 3" (90 phút, 4 phần), "Ngữ văn — Đề số 2", "Tiếng Anh — Đề số 5".
- Điểm thang 10, dấu phẩy thập phân kiểu Việt (7,75). Tiền: "99.000đ".
- Gói mẫu (giá là ví dụ, do Admin cấu hình): "Gói 5 lượt", "Gói 10 lượt", "Gói 30 lượt".
- Thanh toán qua **SePay** (chuyển khoản/QR). Luồng: chọn gói → xác nhận đơn → chuyển sang trang SePay → quay lại màn "Đang xác nhận thanh toán" (hệ thống tự kiểm tra) → thành công (cộng lượt) / thất bại.
- Xếp hạng (chốt): **Bảng tuần** (mặc định) = 10 điểm mỗi đề hoàn thành + điểm bài thang 10, mỗi đề chỉ tính lần tốt nhất; **Bảng thành tích** = điểm cao nhất theo đề/môn, mọi lúc; học sinh bật/tắt **ẩn tên khỏi bảng xếp hạng**.
- Đăng nhập: chỉ email + mật khẩu (**không có Google/Facebook**). Có "Quên mật khẩu?".
- Tên người mẫu khác: Trần Gia Bảo, Nguyễn Hà My, Lê Quốc Huy, Phạm Thu Trang, Đỗ Minh Khoa, Vũ Ngọc Anh.

---

## 8. Trong code (frontend)

> Phần trên chép nguyên từ `design/design-system.md` (nguồn chuẩn của Athena). Có thay đổi thì sửa ở nguồn rồi chép lại; mục 8 này do frontend giữ.

- **Token:** `src/styles/tokens.css`, biến `--vt-*` (`--vt-ink`, `--vt-paper`, `--vt-action`, `--vt-sun`, `--vt-err`, `--vt-title-bg`…, bo góc `--vt-r-card-lg`, `--vt-r-card-md`, `--vt-r-btn`, `--vt-r-chip`, viền `--vt-border`). Không viết mã màu trực tiếp trong component mới — dùng biến. Biến `--tk-*` là của màn Giáo viên cũ (Semantic UI), không dùng cho màn mới.
- **Font tự host:** Inter + Patrick Hand ở `src/styles/fonts-d.css` (file woff2 trong `src/styles/fonts/`, kèm LICENSE). Không gọi Google Fonts cho 2 font này.
- **Nền trang:** `.vt-paper` (giấy chấm, màn HS/Admin) và `.vt-plain` (trắng phẳng, phòng thi). Style chung, `h1–h5`, `p`, link chỉ áp trong hai vùng này để không đụng màn GV cũ.
- **Patrick Hand:** chỉ qua class có sẵn (`.vt-hand`, tiêu đề, số lớn, đồng hồ) — luôn 700, **không dưới 18px** (bảng xếp hạng: điểm 22px, hạng 20px).
- **Link:** link chữ dùng `className='vt-link'` (mực, gạch chân, offset 3px, 600). Link không class trong `.vt-paper/.vt-plain` tự có kiểu này; link dạng thẻ (`a.vt-card`) giữ màu mực khi hover/focus — không bao giờ xanh `#4183c4` của Semantic.
- **Nút:** `Button` / `buttonClass()` với `variant` primary · secondary · ghost (nút chữ) · danger. Hành động nguy hiểm trong bảng (Khoá) = ghost + `vt-btn-danger-text` (chữ đỏ, không viền).
- **Trạng thái:** đang tải = `Skeleton`/`SkeletonCard` (không spinner giữa trang); rỗng = `EmptyState`; lỗi = `ErrorState` + "Thử lại".
- **Danh hiệu:** `TitleChip` — newbie xám, diligent xanh `#D0E9FD`, warrior vàng `#FFFBDB/#7A4B00`, conqueror tím `#E5DCFB/#4A347F`.
- **Ngày giờ, điểm, tiền:** luôn qua `src/lib/format.ts` (giờ Việt Nam, dấu phẩy thập phân, `99.000đ`).
- Danh sách component và cách dùng: [components.md](components.md). Trang xem trực tiếp: `/dev/ui` (chỉ khi chạy dev).

## Giao diện Học sinh theo canvas v29 (SPT-82)

- **Header HS** không có nút đăng xuất; đăng xuất nằm ở màn Tài khoản. Header GV dùng `IconButton` đăng xuất (icon có viền, tooltip).
- **Bỏ tính năng ẩn tên khỏi bảng xếp hạng** (anh Thịnh 27/10): không còn công tắc ở Tài khoản, ghi chú ở Xếp hạng, nhãn "Học sinh ẩn danh"; FE không gọi `me/ranking_privacy`.
- **Bỏ các dòng giải thích** theo canvas: "Không hết hạn", "Giáo viên sẽ chấm phần này", "Hết đề", quy tắc +10 điểm ở Top tuần và đầu bảng xếp hạng, dòng "Đã chờ N giây", chữ SePay (thay bằng "ngân hàng"); `Kiểm tra lại` chỉ còn ở trạng thái hết thời gian chờ (cần để bấm kiểm tra tiếp).
- **Thẻ môn** chỉ tên + số đề. **Tiêu đề phần câu**: điểm do giáo viên đặt (Q3), FE lấy từ `max_score` của đề, "0,25đ/câu" trên canvas chỉ là ví dụ. Mọi câu trong phần bằng điểm → ghi gọn "<điểm>đ/câu" (số kiểu Việt); khác nhau → không ghi ở tiêu đề, mỗi câu hiện điểm nhỏ cạnh số câu ("Câu 3 0,5đ"). Không ghi cách tính bậc Đúng/Sai; phần tự luận không có dòng này (điểm nằm ở tên câu).
- **Kết quả bài còn tự luận chờ chấm** (anh Thịnh chốt Q20): chỉ hiện "Chúc mừng bạn đã hoàn thành bài thi của mình. Bài thi của bạn sẽ được giáo viên phụ trách chấm điểm" — không điểm tạm, không bảng điểm theo phần, không điểm xếp hạng (Q19: chưa chấm xong không vào bảng). Chấm xong mới hiện điểm và +điểm xếp hạng.
- **"Xem lại sau"** là icon cờ có tooltip (`IconButton`, `aria-pressed`). Mọi nút icon (đóng Modal, thoát bài thi, quay lại thanh toán, avatar → Tài khoản) có tên hiện khi hover/focus.
- **Top 1–3** bảng xếp hạng nổi bật: huy chương 36px viền mực + bóng cứng. **Huy hiệu danh hiệu** mọi bậc cùng màu tím nhạt, chữ thuần (không vương miện).
- **Focus ô nhập** chỉ đậm viền (`inset 0 0 0 1.5px` mực), không còn vòng xanh, không xô lệch bố cục — áp cho toàn app.
- Xem lại bài: nhãn "Bạn chọn"/"Đáp án đúng" chuyển thành chữ chỉ dành cho trình đọc màn hình (màu đã nói đủ trên màn).
- Chưa có (BE chưa trả): số sao trong header/Tài khoản, tiến độ danh hiệu theo sao.
