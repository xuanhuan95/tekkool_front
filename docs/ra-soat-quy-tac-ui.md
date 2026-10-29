# Rà soát giao diện theo 11 quy tắc chung (SPT-91)

Nguồn quy tắc: `design/quy-tac-chung.md`. Rà trên `main` (b6f0917), nhánh `feature/SPT-91-ui-rules`.
Cách rà: đọc từng màn của 3 vai + grep toàn `src/` (nút icon, `outline`/`:focus`, Editor, link, spinner/`Loading`, Patrick Hand,
nút xoá/khoá, định dạng điểm/tiền, tiêu đề + dòng phụ). Riêng quy tắc 2 đã **đo thật trên production** (xem L-02).

**Trạng thái:** bước 2 xong (PR SPT-91). PM duyệt bảng 28/10/2026; kết quả xử lý từng dòng ở mục "Kết quả xử lý" cuối file.

Mức: **B** = Bắt buộc sửa · **N** = Nên sửa · **G** = Góp ý. Cột "Vai": HS · GV · AD · Chung (mọi vai).

## Bối cảnh cần PM biết trước (ảnh hưởng cách sửa)

1. **Phần lớn lỗi nằm ở màn giáo viên cũ dựng bằng Semantic UI** (chưa reskin): soạn/sửa đề (`CreateExam`, `Section`, `questions/*`),
   chấm bài (`SubmissionDetail`, `ToGrade`, `MySubmissions`), `Profile`. Các màn kiểu "vt-" (HS, Admin, Môn & đề, Ngân hàng, Import, Nhập) gần như đạt.
   Cách sửa tôi đề xuất: **sửa ở component/CSS dùng chung và ép style Semantic về token** (không viết lại màn). Reskin hẳn là việc sprint sau.
2. **Code chết / không còn đường vào** (đề xuất xoá, hỏi PM): `dashboard/SubjectBrowser.tsx`, `dashboard/UserBlock.tsx`,
   CSS `.tk-cfb-*` (App.css), `StudentNav.tsx` + nhánh "học sinh" của `TopToolbar` (chỉ `VisitorView` mới gọi; Google/Facebook đã tắt hẳn).
   `/design-system` (`DesignSystem.tsx`, bản Semantic cũ) **vẫn mở được trên production** vì `App.tsx:50` không chặn bằng `import.meta.env.DEV`.
3. Giáo viên bấm avatar → `/profile` (legacy) nhưng `TEACHER_D` (`AuthenticateView.tsx:44`) không có `profile`, nên trang đó đổi sang header Semantic cũ có nút chữ "Logout".

## Bảng lỗi

### Quy tắc 1 · Nút chỉ có icon phải có tooltip, 44×44, dùng IconButton

| # | Vai | Màn | Đang sai | File:dòng | Cách sửa | Mức |
|---|---|---|---|---|---|---|
| L-01 | GV | Soạn đề · xoá câu / xoá phần / xoá đáp án | `<Icon name='close' onClick>` (✕ trần): không tên, không tooltip, không bàn phím, nhỏ | `exam-creation/Section.tsx:131-136`, `CreateExam.tsx:348`, `questions/MultipleChoice.tsx:176` | Thay bằng `IconButton` (`label` "Xoá câu 3", "Xoá phần 2", "Xoá đáp án B"); có `IconX` trong `icons.tsx` (thêm nếu thiếu) | B |
| L-02 | GV | Tạo đề từ ngân hàng · hàng cấu trúc | Nút ↑ ↓ × là ký tự chữ, 32px, có `aria-label` nhưng không tooltip, không viền mực | `CreateFromBank.tsx:210-213`, `:243`; `App.css:1224-1235` | Dùng `IconButton` (`IconArrowUp/Down` có sẵn, thêm `IconX`) | B |
| L-03 | HS | Làm bài · ảnh bài làm · nút xoá ảnh | `.hs-aimg-x` 28×28; có `aria-label`+`title` nhưng không tooltip hiện khi focus | `exam/AnswerImages.tsx:39`, `hs/hs.css:132` | Dùng `IconButton` 44×44 đặt chồng góc thumbnail (hoặc mở vùng bấm 44 bằng `.vt-hit`) | N |
| L-04 | GV, HS | Thanh công cụ Editor (B I U Σ, ⋯) | `.tt-btn` 36×36, không viền mực. Tooltip + aria đủ. DS-Editor (SPT-83) cố ý 36px | `EditorToolbar.tsx:16,69`, `Editor.css:12-17` | **Hỏi PM**: giữ 36px cho thanh công cụ, hay đúng "luôn 44×44"? (chỉ đổi CSS nếu PM muốn 44) | N |
| L-05 | GV | `/profile` · chuông chấm bài (header cũ) | Icon-only `Menu.Item` có `title`, thiếu `aria-label`/tooltip | `TopToolbar.tsx:30-39` | Hết khi L-14 (đưa `/profile` vào TeacherLayout); nếu không, thêm `aria-label` | G |

### Quy tắc 2 · Ô nhập focus: chỉ dày viền, không outline

| # | Vai | Màn | Đang sai | File:dòng | Cách sửa | Mức |
|---|---|---|---|---|---|---|
| L-06 | **Chung** | Mọi `TextField`/`TextArea`/`Select`/`PasswordField`/`DateField` trong `.vt-paper` (Đăng nhập, Đăng ký, Tài khoản HS, form Admin, bộ lọc…) | **Viền đôi**: luật focus chung có độ ưu tiên (0,3,0) thắng `.vt-input:focus-visible` (0,2,0), nên input vừa có `outline:3px` vừa có inset 1,5px. **Đã đo trên viettestpro.vn**: `outline: 3px solid`, `box-shadow: inset 0 0 0 1.5px` cùng lúc | `components/ui/ui.css:54-58` | Bỏ `input, select, textarea` khỏi selector `:is(...)` ở dòng 54 (giữ cho `a, button, [tabindex]`). 1 dòng, sửa cho cả 3 vai | B |
| L-07 | HS | Làm bài · ô tự luận (Editor) | Focus vẽ **vòng ngoài** `0 0 0 3px` xanh, đè lên inset của Editor | `components/ui/exam/exam.css:367` | Xoá dòng; để `Editor.css:2` (inset 1,5px) | B |
| L-08 | GV | Chấm trên ảnh · ô ghi chú dấu | Focus dùng `--vt-focus` = 2 vòng ngoài (halo) | `my/image-marker.css:66` | `box-shadow: inset 0 0 0 1.5px var(--vt-ink)` | B |
| L-09 | GV | Chấm bài (ô điểm, nhận xét câu, nhận xét chung) · Soạn đề (tên đề, điểm, `FreeAnswer`, `ShortAnswer`, `FillBlank`, `MultipleChoice`) | Input/TextArea/Form của Semantic: focus **đổi màu viền** sang xanh nhạt | `my/SubmissionDetail.tsx:111,121,227`; `exam-creation/CreateExam.tsx` (Input), `questions/FreeAnswer.tsx`, `ShortAnswer.tsx`, `FillBlank.tsx`, `MultipleChoice.tsx` | Một khối CSS ghi đè (`.ui.input.focus>input`, `.ui.form input:focus`, `.ui.form textarea:focus`) về viền mực + inset 1,5px, lỗi vẫn đỏ #B42318. Không đụng JSX | B |
| L-10 | GV | `/profile` (đổi tên, mật khẩu) | `.tk-field input:focus` đổi màu viền + halo 3px | `pages/student.css:499-503`, dùng ở `my/Profile.tsx` | Gộp với L-09 hoặc Profile dùng `TextField`/`PasswordField` (nhỏ) | B |
| L-11 | GV | Môn & đề · ô chọn "Chuyển môn" | `<select class='vt-th-move'>` tự chế, viền 1,5px, focus chỉ có ring ngoài chung | `dashboard/Dashboard.tsx:170`, `teacher-home.css:19` | Dùng `Select` dùng chung; hoặc style như `.vt-input` | N |

### Quy tắc 3 · Editor: dùng DS-Editor

| # | Vai | Màn | Đang sai | File:dòng | Cách sửa | Mức |
|---|---|---|---|---|---|---|
| L-12 | (dev) | `EssayAnswer` nhánh không truyền `editor` | Thanh công cụ **tự chế** B / I / Σ / **Chèn ảnh** + `<textarea>`. Production luôn truyền `Editor` (`QuestionView.tsx:59`), chỉ `/dev/ui/lam-bai` dùng nhánh này | `components/ui/exam/QuestionBlock.tsx:141-163`, `exam.css` `.vt-essay-tool*` | Xoá nhánh `onTool`/`TOOLS`/`<textarea>` (+ cập nhật `DevExam`, test). Tránh ai vô tình dùng lại | N |
| L-13 | GV | Soạn/sửa đề | Biến thể `teacher` có **nút chèn ảnh**. Quy tắc 3 viết "GV soạn/sửa đề: B I U Σ, **không nút ảnh**". Chưa rõ ảnh trong đề (import từ Word có ảnh) | `EditorToolbar.tsx` (variant teacher), `ImageDialog.tsx` | **Hỏi PM**: bỏ nút ảnh của GV, hay quy tắc chỉ nói về HS? Chưa sửa | — |

### Quy tắc 4 · Đăng xuất

| # | Vai | Màn | Đang sai | File:dòng | Cách sửa | Mức |
|---|---|---|---|---|---|---|
| L-14 | GV | `/profile` (và mọi route GV ngoài `TEACHER_D`) | Header cũ: chữ "Chào bạn {tên}" + nút chữ **"Logout"** (tiếng Anh) | `TopToolbar.tsx:41-47`, `AuthenticateView.tsx:44` | Thêm `profile` vào `TEACHER_D` để dùng `TeacherLayout` (avatar + IconButton "Đăng xuất"). Không đổi route/hành vi | B |
| L-15 | (chết) | `UserBlock`, `StudentNav` | Chữ "Logout" / menu "Đăng xuất" kiểu cũ | `dashboard/UserBlock.tsx:26`, `StudentNav.tsx:109,118` | Xoá file (code chết, xem Bối cảnh 2) | G |

Đạt: `AdminLayout` (avatar + IconButton, không in "Quản trị viên"), `TeacherLayout`, HS `AccountPage` (nút "Đăng xuất" viền đỏ cuối trang, không ở thanh menu).

### Quy tắc 5 · Ảnh bài làm và chấm trên ảnh

Không thấy lỗi qua grep: `MAX_ANSWER_IMAGES = 3`, `MAX_MARKS_PER_IMAGE = 200`, `MAX_NOTE_LENGTH = 500`, dấu lưu dạng % dữ liệu riêng. Chưa kiểm hành vi ("HS chỉ thấy dấu khi Đã chấm", giới hạn 2 MB): thuộc E2E của Apollo, không phải hiển thị.

### Quy tắc 6 · Tiêu đề trang không kèm câu giải thích

| # | Vai | Màn | Đang sai | File:dòng | Cách sửa | Mức |
|---|---|---|---|---|---|---|
| L-16 | Chung | Đăng nhập, Đăng ký | Phụ đề giải thích dưới tiêu đề: "Đăng nhập để luyện tiếp đề thi.", "Chỉ mất một phút để bắt đầu luyện đề." | `auth/Login.tsx:56`, `Register.tsx:61`, `AuthFrame.tsx:23` | Bỏ prop `subtitle` và thẻ `<p>` | B |
| L-17 | HS | Trang chủ, Đề thi | "Hôm nay mình luyện tiếp nhé.", "Chọn môn, rồi chọn đề để xem chi tiết." | `student/StudentHome.tsx:136`, `hs/ExamsPage.tsx:58`, `hs/common.tsx:31-36` (`PageHead.sub`) | Xoá `sub` ở 2 chỗ gọi; bỏ prop `sub` + `.hs-head-sub` | B |
| L-18 | GV | `/profile` | "Cập nhật tên hiển thị và mật khẩu đăng nhập." | `my/Profile.tsx:80` | Xoá | B |
| L-19 | AD | Giao dịch & đối soát (tab Đối soát) | Câu giải thích đầu tab: "Đơn cần xử lý tay. Chỉ đọc dữ liệu đã lưu…" | `manage/Transactions.tsx:98` | Xoá (nếu cần, đưa vào tooltip/ghi chú ngay chỗ thao tác) | B |
| L-20 | AD | Gói thi, Môn học, Giao dịch (thẻ bên phải khi chưa chọn) | Thẻ chỉ để hướng dẫn: "Bấm 'Sửa' ở một gói…", "Bấm 'Đổi tên' ở một môn…", "Bấm mã đơn để xem…"; ghi chú dưới bảng gói | `manage/AdminPackages.tsx:198,191`, `AdminSubjects.tsx:96`, `Transactions.tsx:198` | Đổi sang `EmptyState` một câu (quy tắc 10) hoặc bỏ; ghi chú "Đã bán = …" chuyển thành tooltip ở cột "Đã bán" | N |
| L-21 | GV, AD, HS | Dòng dữ liệu dưới tiêu đề **không ở dạng chip**: "N môn · M đang ẩn", "{n} khối", "Tổng {n} · Hoạt động…", "Tổng {n} học sinh", kỳ doanh thu, "Lưu vào ngân hàng …", tên môn (DrawExam), "Bạn còn N lượt", "Đã mua N gói", "N bài đã nộp", "N bài · M chờ chấm" | `dashboard/Dashboard.tsx:63`, `question-bank/BankBlocks.tsx:110`, `manage/Teachers.tsx:152`, `Users.tsx:47`, `Revenue.tsx:182`, `exam-creation/ImportExam.tsx:355`, `DrawExam.tsx:43`, `pay/Packages.tsx:29`, `PurchaseHistory.tsx:36`, `my/MySubmissions.tsx:40`, `my/ToGrade.tsx:57-60`, `exam/ReviewPage.tsx:118` | Dòng này là dữ liệu có ích nên **giữ**, nhưng đổi `<p>`/`<span>` thành dòng `Badge`/chip dưới tiêu đề (`.vt-chip-row` có sẵn). Làm 1 helper `MetaChips` nếu gọn | N |

### Quy tắc 7 · Patrick Hand đậm, ≥18px, chỉ tiêu đề/số lớn

| # | Vai | Màn | Đang sai | File:dòng | Cách sửa | Mức |
|---|---|---|---|---|---|---|
| L-22 | GV | Chấm trên ảnh · danh sách ghi chú | `.mk-notes b` Patrick Hand **17px** (<18), không khai báo đậm | `my/image-marker.css:75` | 18px + `font-weight:700` (hoặc dùng Inter 600) | B |
| L-23 | GV | Chấm trên ảnh · tiêu đề danh sách dấu | `.mk-list-title` 19px, thiếu `font-weight:700` | `my/image-marker.css:53` | thêm `font-weight:700` | B |
| L-24 | GV | Môn & đề, Nhập đề | `h2` Patrick Hand thiếu `font-weight:700` khai báo (đang đậm nhờ mặc định `h2`, mong manh) | `dashboard/teacher-home.css:16`, `exam-creation/import-exam.css:6` | thêm `font-weight:700` | G |

Đạt: mọi chỗ khác dùng Patrick Hand đều ≥18px và 700; không thấy Patrick Hand cho nội dung câu hỏi/đáp án/bảng.

### Quy tắc 8 · Liên kết giữ màu mực

Phần lớn đạt: link trong `.vt-paper` được luật chung ép mực + gạch chân (`ui.css:31-39`), kể cả khi hover/focus. Chỉ còn:

| # | Vai | Màn | Đang sai | File:dòng | Cách sửa | Mức |
|---|---|---|---|---|---|---|
| L-25 | GV | Soạn đề (bản Semantic) | Dùng xanh `#2185d0` làm màu nhấn: viền trái phần đang chọn, icon `+` khi hover, `.txt-blue` | `App.css:121,177,351` | Đổi sang `var(--vt-ink)`/`--vt-action` (không phải link, nhưng cùng tinh thần "không xanh Semantic") | G |
| L-26 | GV | `/profile` ngoài `.vt-paper` | Link trong trang này không được luật mực áp dụng (Semantic xanh `#4183c4`) | `my/Profile.tsx` | Hết khi L-14 | G |

### Quy tắc 9 · Hành động nguy hiểm: chữ đỏ không viền, mọi xoá có xác nhận, focus vào Huỷ

`ConfirmDialog` đạt (focus vào nút Huỷ, `Modal.tsx:111`). Nút xoá trong bảng/thẻ đạt: `.vt-th-del`, `.vt-qb-remove`, `.vt-imp-remove` đều chữ đỏ, không viền.

| # | Vai | Màn | Đang sai | File:dòng | Cách sửa | Mức |
|---|---|---|---|---|---|---|
| L-27 | GV | Soạn đề · xoá câu, xoá phần | **Xoá ngay, không hộp xác nhận** (mất cả câu + đáp án đã soạn) | `exam-creation/Section.tsx:58,132`, `CreateExam.tsx:316,348` | Bọc bằng `ConfirmDialog tone='danger'` ("Giữ lại"/"Xoá câu") | B |
| L-28 | GV | Nhập đề (Import) · "Xoá" câu | Xoá câu khỏi bản nháp import ngay, không xác nhận | `exam-creation/ImportExam.tsx:92-93` | `ConfirmDialog` | B |
| L-29 | GV | Tạo đề từ ngân hàng · bỏ khối khỏi cấu trúc | Xoá ngay | `CreateFromBank.tsx:96,213` | `ConfirmDialog` hoặc để (có thể thêm lại ngay) — **PM chọn** | N |
| L-30 | AD | Giáo viên, Học sinh · Khoá tài khoản (trong bảng) | Dùng **IconButton khoá (icon đỏ, viền mực)**; quy tắc 9 và canvas viết "chữ đỏ 'Khoá tài khoản' trong dòng bảng". `ui.css:322` đã có kiểu `vt-btn-danger-text` nhưng chưa ai dùng | `manage/Teachers.tsx:139-141`, `manage/shared.tsx` (cột thao tác Users), `ui.css:322` | **Hỏi PM**: giữ icon (SPT-77, quy tắc 1) hay chuyển chữ đỏ (quy tắc 9)? Chưa sửa | — |
| L-31 | GV | Chấm trên ảnh · xoá dấu | Xoá dấu ngay (icon trong danh sách, và nút "Xoá dấu" trong hộp). Lưu bản nháp trên máy nên hoàn tác được bằng không bấm Lưu | `my/ImageMarker.tsx:49,63,140` | Để nguyên, ghi lý do (chưa lưu lên server) — **PM xác nhận** | G |

### Quy tắc 10 · Trạng thái đang tải, rỗng, lỗi

| # | Vai | Màn | Đang sai | File:dòng | Cách sửa | Mức |
|---|---|---|---|---|---|---|
| L-32 | Chung | Khởi động app (trước khi biết đăng nhập), mở khu Admin | `<Loading/>` = **4 cột sóng xoay** giữa trang (chính là kiểu spinner) | `pages/App.tsx:53`, `AuthenticateView.tsx:60`, `components/Loading.tsx` | Thay `Loading` bằng khung Skeleton xám #EFEFEC (một `PageSkeleton` dùng `Skeleton`); xoá `.tk-load*` | B |
| L-33 | GV | Chấm bài, Danh sách bài chờ chấm, Lịch sử bài nộp, Soạn/sửa đề | `<Loading/>` giữa trang | `my/SubmissionDetail.tsx:204`, `my/ToGrade.tsx:41`, `my/MySubmissions.tsx:35`, `exam-creation/CreateExam.tsx:180` | Cùng `PageSkeleton` | B |
| L-34 | GV | Chấm bài, Bài chờ chấm | Lỗi tải là `Message negative` (nền hồng Semantic), **không nút "Thử lại"** | `my/ToGrade.tsx:40`, `my/SubmissionDetail.tsx:203` | `ErrorState` + `onRetry` (cần `refetch`; màn dùng `useEffect`+state, thêm hàm gọi lại — không đổi API) | B |
| L-35 | GV | Chấm bài · lưu lỗi; Đúng/Sai thiếu ý | Hộp lỗi Semantic `negative` thay vì thẻ viền đỏ | `my/SubmissionDetail.tsx:235`, `exam-creation/TrueFalseBlock.tsx:31` | Thẻ lỗi `Card tone='error'` | N |
| L-36 | GV | Ngân hàng · nội dung | Chữ "Đang tải…" thay số khối | `question-bank/BankBlocks.tsx:110` | `Skeleton` nhỏ (hoặc ẩn dòng đến khi có) | N |
| L-37 | GV | Chấm trên ảnh · ảnh đang tải | Chữ "Đang tải ảnh…" trong khung | `my/ImageMarker.tsx:220` | Khối xám #EFEFEC, `role=status` giữ nguyên | G |

### Quy tắc 11 · Điểm kiểu Việt, thang 10

| # | Vai | Màn | Đang sai | File:dòng | Cách sửa | Mức |
|---|---|---|---|---|---|---|
| L-38 | GV | Chấm bài, Bài chờ chấm, Lịch sử bài nộp (nhãn điểm) | `ScoreLabel` in `{round(score)} / {round(max)}` là **số JS → dấu chấm** ("8.5 / 10") | `my/fmt.tsx:49,55` (dùng ở `ToGrade.tsx:82`, `MySubmissions.tsx`, `SubmissionDetail.tsx`) | Dùng `formatDecimal` (`lib/format.ts:12`) hoặc `formatScore`; xoá `round` | B |
| L-39 | GV | Chấm bài · tiêu đề từng câu, điểm tối đa | "Câu 3 · 1.25 / 2" dấu chấm | `my/SubmissionDetail.tsx:58,141,180` | `formatDecimal(...)` cho hiển thị (ô nhập `type=number` giữ nguyên) | B |
| L-40 | GV | Nhập đề · tỷ lệ trùng | "Tỷ lệ trùng: 85.00%" dấu chấm | `exam-creation/ImportExam.tsx:55,57` | `formatDecimal(x, 2)` + `%` | N |
| L-41 | GV | Dùng chung trong `fmt.tsx` | `fmtMoney` = `toLocaleString('vi-VN') + ' đ'` ("99.000 đ", có dấu cách; quy tắc: `99.000đ`) và `fmtDate` ra "20:11:00 15/10/2026" lệch `formatDateTime` | `my/fmt.tsx:12-17,26-27` | `fmtMoney` hiện không có chỗ gọi: xoá. `fmtDate` → `formatDateTime` (`lib/format.ts:89`) | N |
| L-42 | Chung | `formatScore` | Luôn 2 chữ số: "8,50 / 10", "10,00 / 10". Quy tắc ví dụ "8,5 / 10", "7,75". **Chưa rõ** nên bỏ số 0 thừa hay giữ 2 chữ số | `lib/format.ts:24-27` (gọi ở ~15 chỗ HS/GV) | **Hỏi PM** trước khi đổi (đổi 1 chỗ lan cả HS). Nếu bỏ số 0 thừa: dùng `formatDecimal`, cập nhật test | — |

Đạt: tiền HS/Admin dùng `formatMoney` ("99.000đ"); xếp hạng dùng `formatPoints` (1 chữ số, dấu phẩy); tổng điểm đề ở editor dùng dấu phẩy.

## Tóm tắt

Có 42 dòng: 39 lỗi (B = 21, N = 11, G = 7) và 3 dòng chờ PM quyết định (L-13, L-30, L-42).

| Quy tắc | Số lỗi | B | N | G |
|---|---|---|---|---|
| 1 Nút icon | 5 | 2 | 2 | 1 |
| 2 Focus ô nhập | 6 | 5 | 1 | 0 |
| 3 Editor | 1 (+1 hỏi) | 0 | 1 | 0 |
| 4 Đăng xuất | 2 | 1 | 0 | 1 |
| 5 Ảnh bài làm | 0 | | | |
| 6 Dòng giải thích | 6 | 4 | 2 | 0 |
| 7 Patrick Hand | 3 | 2 | 0 | 1 |
| 8 Link | 2 | 0 | 0 | 2 |
| 9 Nút nguy hiểm | 4 (+1 hỏi) | 2 | 1 | 1 |
| 10 Đang tải/lỗi | 6 | 3 | 2 | 1 |
| 11 Điểm/tiền | 4 (+1 hỏi) | 2 | 2 | 0 |

Theo vai: **GV 29** (nhiều nhất, do màn Semantic cũ), **HS 3**, **Admin 2**, **Chung 3** (L-06 viền đôi, L-16 phụ đề đăng nhập, L-32 loading toàn app), **nhiều vai 2** (L-04, L-21). L-06 là lỗi lớn nhất: sửa 1 dòng CSS, đúng cho cả 3 vai.

## Chỗ cố ý để lại (nếu PM đồng ý)

- L-04 thanh công cụ Editor 36px; L-31 xoá dấu trên ảnh không xác nhận; reskin hoàn toàn các màn Semantic (chỉ ép về token ở đợt này).

## Kết quả xử lý (bước 2)

Quyết định của PM: L-04 sửa lên 44×44 (chỉ CSS); L-13 giữ nút ảnh của GV (quy tắc 3 sẽ được Athena sửa, không đụng code); L-30 chữ đỏ "Khoá"/"Mở khoá"; L-42 bỏ số 0 thừa, tối đa 2 chữ số.

| Dòng | Trạng thái | Ghi chú |
|---|---|---|
| L-01 | Đã sửa | `IconButton` + `ConfirmDialog` cho xoá câu (`Section`) và xoá phần (`CreateExam`); xoá đáp án dùng `IconButton` (không xác nhận, đáp án thêm lại ngay). Thêm `title`/`aria-label` cho các nút "+" loại câu ở thanh phải (L-43 phát sinh) |
| L-02 | Đã sửa | `CreateFromBank`: `IconButton` ↑ ↓ ✕ và "+" (đã 44px, nay có tooltip + viền mực); bỏ CSS nút cũ |
| L-03 | Đã sửa | `.hs-aimg-x` là `IconButton` 44×44 |
| L-04 | Đã sửa | `.tt-btn` 44×44 |
| L-05, L-26 | Đã hết | Nhờ L-14 |
| L-06 | Đã sửa | `ui.css`: bỏ ô nhập khỏi luật outline chung (giữ checkbox/radio); thêm luật focus cho `select`/`textarea`/`input` ngoài `.vt-input`. Đo lại: `outline: none`, inset 1,5px |
| L-07, L-08, L-10 | Đã sửa | Bỏ halo ngoài; chuyển sang inset 1,5px |
| L-09 | Đã sửa | Một khối CSS ghi đè Semantic `Input`/`Form` focus (cuối `ui.css`) |
| L-11 | Đã sửa | Gộp vào luật focus mới (select) |
| L-12 | Đã sửa | Bỏ `onTool`/`EssayTool`/thanh công cụ tự chế khỏi `QuestionBlock` (+ test, DevExam, CSS) |
| L-13 | Để lại | PM: giữ nút ảnh của GV |
| L-14 | Đã sửa | `profile` vào `TEACHER_D`; "Logout" trong `TopToolbar` đổi thành "Đăng xuất" |
| L-15 | Đã sửa | Xoá `StudentNav`, `UserBlock`, `SubjectBrowser`; `TopToolbar` chỉ còn nhánh giáo viên (khách `visitor` không còn thanh menu) |
| L-16–L-19 | Đã sửa | Bỏ phụ đề đăng nhập/đăng ký, `PageHead.sub`, `tk-sub` ở `/profile`, câu giải thích tab Đối soát |
| L-20 | Đã sửa | Thẻ hướng dẫn thành `EmptyState` một câu; ghi chú "Đã bán" thành tooltip cột |
| L-21 | Đã sửa | Component `MetaChips` (dòng chip dưới tiêu đề) ở 12 màn |
| L-22–L-24 | Đã sửa | Patrick Hand ≥18px, đậm |
| L-25 | Đã sửa | Xanh `#2185d0` đổi sang mực |
| L-27, L-28 | Đã sửa | L-28 (vòng 2): xoá câu ở Nhập đề có `ConfirmDialog`, focus vào "Giữ lại" |
| L-29 | Để lại | PM: thêm lại ngay được nên không cần xác nhận |
| L-30 | Đã sửa | Bảng giáo viên: nút chữ đỏ "Khoá", "Mở khoá" thường (có `aria-label` đầy đủ). Hộp xác nhận giữ nguyên |
| L-31 | Để lại | PM: dấu trên ảnh chưa lưu lên server, bỏ không lưu là hoàn tác |
| L-32, L-33 | Đã sửa | `Loading` thành trang khối xám (`Skeleton`); xoá `.tk-load*` |
| L-34 | Đã sửa | `ErrorState` + "Thử lại" ở `ToGrade`, `SubmissionDetail`, `MySubmissions` |
| L-35 | Một phần | Lỗi lưu điểm thành thẻ viền đỏ; `TrueFalseBlock` (hộp `negative`) để lại, cùng kiểu cảnh báo trong editor |
| L-36, L-37 | Đã sửa | Bỏ chữ "Đang tải…", khối xám trong khung ảnh |
| L-38, L-39 | Đã sửa | `formatDecimal` (dấu phẩy) ở `ScoreLabel` và màn chấm |
| L-40 | Đã sửa | Tỷ lệ trùng dùng dấu phẩy |
| L-41 | Một phần | Xoá `fmtMoney` (không ai gọi). `fmtDate` giữ nguyên (còn dùng ở `rankingQuery`, có test) |
| L-42 | Đã sửa | `formatScore` bỏ số 0 thừa (8,5; 10; 7,75); test cập nhật |
| L-43 | Đã sửa | (phát sinh) nút "+" loại câu ở thanh phải trình soạn đề chỉ có icon: thêm `title` + `aria-label` |

Ngoài bảng: `/design-system` chỉ còn khi chạy dev (`import.meta.env.DEV`). Còn lại CSS `.tk-cfb-*`/`.tk-folder` vì catalogue dev `DesignSystem.tsx` vẫn dùng; xoá cùng catalogue ở đợt reskin.

### Vòng 2 (Apollo quét lại PR #20, 29/10/2026)

| Dòng | Quy tắc | Trạng thái | Ghi chú |
|---|---|---|---|
| L-44 | 8 | Đã sửa | Dàn ý trong trình soạn đề (`ExamResume`): bỏ `.txt-orange`; link S1–S4 và Q1–Q23 màu mực, gạch chân, 600, cao ≥44px, hover/focus vẫn mực |
| L-45 | 8 | Đã sửa | Hover link thường `#000` đổi về mực (`ui.css`) — sửa cho `/edit-exam`, `/to-grade` |
| L-46 | 8 | Đã sửa | Tab con Admin (Quản lý gói · Doanh thu) và thanh dưới điện thoại: chữ mực cố định, không đổi màu khi hover; tab con cao 44px |
| L-47 | 10 | Đã sửa | `/create-exam`, `/edit-exam`: `ErrorState` + "Thử lại" khi tải đề hoặc danh sách môn lỗi; `/import-exam`: khi tải môn/ngân hàng lỗi hoặc không đọc được file |
| L-48 | 5 | Đã sửa | Input file ảnh bài làm: `accept='image/jpeg,image/png'` |
| L-28 | 9 | Đã sửa | xem trên |

Không sửa (PM chốt): thẻ bấm được (`a.hs-subject`) và nút dạng button không cần gạch chân; xoá phương án A/B/C/D không cần xác nhận.
